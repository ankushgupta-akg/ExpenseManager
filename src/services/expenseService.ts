import { AIIntegration } from '../integrations/aiIntegration';
import { ExpenseRepository } from '../repositories/expense.repository';
import { SplitRepository } from '../repositories/split.repository';
import { UserRepository } from '../repositories/user.repository';
import { GroupRepository } from '../repositories/group.repository';
import { logger } from '../utils/logger';
import { formatCurrency } from '../utils/money';
import { LockService } from './lock.service';
import { SessionService, UserSession } from './session.service';
import { IntentService } from './intent.service';
import { NormalizationService } from './normalization.service';
import { ParticipantService } from './participant.service';
import { AIService } from './ai.service';
import { ValidationService, ExpenseDraft } from './validation.service';
import { FallbackService } from './fallback.service';
import { FinancialService } from './financial.service';
import { GroupService } from './group.service';
import { DuplicateService } from './duplicate.service';

const fallbackExpenseMessage = "Could not understand, try: 'I paid 500 for dinner with Rahul'";
const fallbackBalanceMessage = 'Sorry, I could not fetch your balances right now. Please try again.';
const greetingPattern = /^(hi|hello|hey|hii|yo|hola|namaste)\b/i;

interface DraftState {
  total?: number;
  category?: string;
  participants?: string[];
  split?: Record<string, number>;
  groupId?: string;
}

const toTitleCase = (value: string): string =>
  value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(' ');

const toExpenseDraft = (input: DraftState): ExpenseDraft | null => {
  if (!input.total || input.total <= 0) {
    return null;
  }

  if (!input.category || input.category.trim().length === 0) {
    return null;
  }

  if (!input.split || Object.keys(input.split).length === 0) {
    return null;
  }

  return {
    total: input.total,
    category: input.category,
    split: input.split,
    participants: input.participants ?? Object.keys(input.split)
  };
};

export class ExpenseService {
  private readonly aiService: AIService;
  private readonly sessionService: SessionService;
  private readonly lockService: LockService;
  private readonly intentService: IntentService;
  private readonly normalizationService: NormalizationService;
  private readonly participantService: ParticipantService;
  private readonly validationService: ValidationService;
  private readonly fallbackService: FallbackService;
  private readonly financialService: FinancialService;
  private readonly groupService: GroupService;
  private readonly duplicateService: DuplicateService;

  constructor(
    aiIntegration: AIIntegration,
    private readonly userRepository: UserRepository,
    private readonly expenseRepository: ExpenseRepository,
    private readonly splitRepository: SplitRepository,
    sessionService?: SessionService,
    groupService?: GroupService,
    lockService?: LockService
  ) {
    this.aiService = new AIService(aiIntegration);
    this.sessionService = sessionService ?? new SessionService();
    this.groupService = groupService ?? new GroupService(new GroupRepository());
    this.lockService = lockService ?? new LockService();
    this.intentService = new IntentService();
    this.normalizationService = new NormalizationService();
    this.participantService = new ParticipantService();
    this.validationService = new ValidationService();
    this.fallbackService = new FallbackService();
    this.financialService = new FinancialService(userRepository, expenseRepository, splitRepository);
    this.duplicateService = new DuplicateService(expenseRepository);
  }

  public async handleIncomingMessage(from: string, text: string): Promise<string> {
    logger.info({ message: 'Raw input', from, text });

    const existingUser = await this.userRepository.findByPhone(from);
    const lockKey = existingUser?.id ?? from;
    const lockAcquired = await this.lockService.acquire(lockKey);
    if (!lockAcquired) {
      return 'Please wait a moment, your previous request is still being processed.';
    }

    try {
      const user = existingUser;
      const session = await this.sessionService.get(from);

      logger.info({
        message: 'Session check',
        from,
        hasUser: Boolean(user),
        state: session?.state ?? 'IDLE',
        pendingAction: session?.pending_action ?? null
      });

      if (!user) {
        return this.handleRegistrationFlow(from, text, session);
      }

      const groupId = await this.groupService.ensureDefaultGroup(user.id);

      if (session && session.state !== 'IDLE') {
        const sessionReply = await this.handleSessionFlow(user.id, user.name, from, text, groupId, session);
        if (sessionReply) {
          return sessionReply;
        }
      }

      const intent = this.intentService.detectIntent(text);

      if (intent === 'GET_RECEIVABLE') {
        return this.handleReceivable(user.id);
      }

      if (intent === 'GET_PAYABLE') {
        return this.handlePayable(user.id);
      }

      if (intent === 'GET_BALANCE') {
        return this.handleNetBalance(user.id);
      }

      if (intent === 'SIMPLIFY_DEBTS') {
        return this.handleSimplifyDebts(user.id);
      }

      if (intent !== 'ADD_EXPENSE') {
        return fallbackExpenseMessage;
      }

      return this.handleAddExpense(user.id, user.name, from, groupId, text, undefined);
    } catch (error) {
      logger.error({
        message: 'Unhandled service error',
        from,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return 'Something went wrong. Please try again.';
    } finally {
      await this.lockService.release(lockKey);
    }
  }

  private async handleRegistrationFlow(
    phoneNumber: string,
    text: string,
    session: UserSession | null
  ): Promise<string> {
    if (!session || session.pending_action !== 'REGISTER_USER') {
      await this.sessionService.set(phoneNumber, {
        userId: phoneNumber,
        state: 'AWAITING_NAME',
        intent: 'UNKNOWN',
        pending_action: 'REGISTER_USER',
        data: {}
      });

      return 'Hi! I don’t have you registered. What’s your name?';
    }

    if (session.state === 'AWAITING_NAME') {
      if (!this.validationService.isValidName(text)) {
        return 'Please share a valid name.';
      }

      const saved = await this.userRepository.createRegisteredUser(phoneNumber, text);
      await this.groupService.ensureDefaultGroup(saved.id);
      await this.sessionService.clear(phoneNumber);

      return `You’re registered, ${saved.name}. You can now add expenses.`;
    }

    await this.sessionService.clear(phoneNumber);
    return 'Hi! I don’t have you registered. What’s your name?';
  }

  private async handleSessionFlow(
    userId: string,
    userName: string,
    phoneNumber: string,
    text: string,
    groupId: string,
    session: UserSession
  ): Promise<string | null> {
    const normalized = text.trim().toLowerCase();

    if (session.pending_action === 'ADD_UNKNOWN_USERS' && session.state === 'AWAITING_CONFIRMATION') {
      if (normalized === 'yes' || normalized === 'y') {
        const unknown = (session.data.unknownNames as string[] | undefined) ?? [];
        const draftState = (session.data.draft as DraftState | undefined) ?? {};

        for (const unknownName of unknown) {
          const created = await this.userRepository.createByName(unknownName);
          await this.groupService.addMemberToGroup(groupId, created.id);
        }

        await this.sessionService.clear(phoneNumber);
        return this.completeDraft(userId, userName, phoneNumber, groupId, draftState);
      }

      if (normalized === 'no' || normalized === 'n') {
        await this.sessionService.clear(phoneNumber);
        return 'Okay, cancelled. No expense was saved.';
      }

      return 'Please reply with yes or no.';
    }

    if (session.pending_action === 'CONFIRM_DUPLICATE' && session.state === 'AWAITING_CONFIRMATION') {
      if (normalized === 'yes' || normalized === 'y') {
        const draftState = (session.data.draft as DraftState | undefined) ?? {};
        await this.sessionService.clear(phoneNumber);
        return this.completeDraft(userId, userName, phoneNumber, groupId, draftState);
      }

      if (normalized === 'no' || normalized === 'n') {
        await this.sessionService.clear(phoneNumber);
        return 'Okay, cancelled. No expense was saved.';
      }

      return 'Please reply with yes or no.';
    }

    if (
      session.pending_action === 'COLLECT_PARTICIPANTS' &&
      (session.state === 'AWAITING_PARTICIPANTS' || session.state === 'AWAITING_SPLIT')
    ) {
      const intent = this.intentService.detectIntent(text);
      if (intent !== 'ADD_EXPENSE' && normalized !== 'continue' && normalized !== 'cancel') {
        return 'Continue previous or cancel?';
      }

      if (normalized === 'cancel') {
        await this.sessionService.clear(phoneNumber);
        return 'Okay, cancelled. No expense was saved.';
      }

      const previous = (session.data.draft as DraftState | undefined) ?? {};
      await this.sessionService.clear(phoneNumber);

      return this.handleAddExpense(userId, userName, phoneNumber, groupId, text, previous);
    }

    return null;
  }

  private async handleAddExpense(
    userId: string,
    userName: string,
    phoneNumber: string,
    groupId: string,
    text: string,
    previousDraft: DraftState | undefined
  ): Promise<string> {
    try {
      if (!previousDraft && greetingPattern.test(text.trim())) {
        await this.sessionService.set(phoneNumber, {
          userId,
          state: 'AWAITING_SPLIT',
          intent: 'ADD_EXPENSE',
          pending_action: 'COLLECT_PARTICIPANTS',
          data: {
            draft: {
              category: 'misc',
              participants: [userName],
              groupId
            }
          }
        });

        return 'Sure, let’s add a new transaction. Please share the total amount.';
      }

      const normalized = this.normalizationService.normalizeExpenseText(text, userName);
      const members = await this.groupService.getMembers(groupId);

      logger.info({
        message: 'Normalized input',
        from: phoneNumber,
        normalized: normalized.normalized
      });

      const resolution = this.participantService.resolveParticipants(
        normalized.normalized.cleanedText,
        userName,
        members.map((member) => ({
          userId: member.userId,
          name: member.name,
          aliases: member.aliases
        }))
      );

      logger.info({
        message: 'Participants resolved',
        from: phoneNumber,
        resolved: resolution.resolvedNames,
        unknown: resolution.unknownNames,
        ambiguous: resolution.ambiguous
      });

      if (resolution.ambiguous.length > 0) {
        const first = resolution.ambiguous[0];
        if (!first) {
          return fallbackExpenseMessage;
        }

        return `I found multiple matches for ${first.token}: ${first.options.join(', ')}. Please be more specific.`;
      }

      const participants = Array.from(
        new Set([
          ...(previousDraft?.participants ?? []),
          ...resolution.resolvedNames,
          ...resolution.unknownNames,
          ...(normalized.normalized.hasSelfReference ? [userName] : [])
        ])
      );

      const aiCandidate = await this.aiService.extract({
        text,
        sender: phoneNumber,
        knownUsers: members.map((member) => member.name),
        groupMembers: members.map((member) => member.name),
        defaultGroup: members.map((member) => member.name)
      });

      logger.info({
        message: 'AI response',
        from: phoneNumber,
        aiResponse: aiCandidate
      });

      let aiAmount: number | undefined;
      let aiSplit: Record<string, number> = {};
      let aiCategory: string | undefined;
      let aiParticipants: string[] = [];

      if (aiCandidate) {
        const parsed = this.validationService.parseAIAssist(aiCandidate);
        if (parsed.success && parsed.data.intent === 'ADD_EXPENSE' && parsed.data.data) {
          aiAmount = parsed.data.data.amount;
          aiSplit = parsed.data.data.split ?? {};
          aiCategory = parsed.data.data.category;
          aiParticipants = parsed.data.data.participants?.map((name) => toTitleCase(name)) ?? [];
        }
      }

      const mergedParticipants = Array.from(new Set([...participants, ...aiParticipants]));
      const total = previousDraft?.total ?? normalized.primaryAmount ?? aiAmount;

      if (!total || total <= 0) {
        await this.sessionService.set(phoneNumber, {
          userId,
          state: 'AWAITING_SPLIT',
          intent: 'ADD_EXPENSE',
          pending_action: 'COLLECT_PARTICIPANTS',
          data: {
            draft: {
              ...(previousDraft ?? {}),
              participants: mergedParticipants,
              category: previousDraft?.category ?? normalized.category
            }
          }
        });

        return 'Please share the total amount.';
      }

      if (mergedParticipants.length === 0) {
        await this.sessionService.set(phoneNumber, {
          userId,
          state: 'AWAITING_PARTICIPANTS',
          intent: 'ADD_EXPENSE',
          pending_action: 'COLLECT_PARTICIPANTS',
          data: {
            draft: {
              ...(previousDraft ?? {}),
              total,
              category: previousDraft?.category ?? normalized.category
            }
          }
        });

        return 'Who are the participants?';
      }

      const split = this.fallbackService.buildValidSplit({
        participants: mergedParticipants,
        explicitAmountSplits: {
          ...(previousDraft?.split ?? {}),
          ...normalized.normalized.explicitAmountSplits,
          ...aiSplit
        },
        explicitPercentSplits: normalized.normalized.explicitPercentSplits,
        total
      });

      const draftState: DraftState = {
        total,
        category: previousDraft?.category ?? aiCategory ?? normalized.category,
        participants: mergedParticipants,
        split,
        groupId
      };

      const draft = toExpenseDraft(draftState);
      if (!draft) {
        return fallbackExpenseMessage;
      }

      const validation = this.validationService.validateExpenseDraft(userName, draft);
      logger.info({
        message: 'Validation result',
        from: phoneNumber,
        valid: validation.success,
        issues: validation.success ? [] : validation.error.issues
      });

      if (!validation.success) {
        return fallbackExpenseMessage;
      }

      const unresolved = mergedParticipants.filter(
        (name) => !members.some((member) => member.name.toLowerCase() === name.toLowerCase())
      );

      if (unresolved.length > 0) {
        await this.sessionService.set(phoneNumber, {
          userId,
          state: 'AWAITING_CONFIRMATION',
          intent: 'ADD_EXPENSE',
          pending_action: 'ADD_UNKNOWN_USERS',
          data: {
            unknownNames: unresolved,
            draft: draftState
          }
        });

        return `User ${unresolved.join(', ')} not found. Add to group? (yes/no)`;
      }

      const participantIds = members
        .filter((member) => mergedParticipants.some((name) => name.toLowerCase() === member.name.toLowerCase()))
        .map((member) => member.userId);

      const duplicate = await this.duplicateService.isLikelyDuplicate({
        payerId: userId,
        total,
        participantIds
      });

      if (duplicate) {
        await this.sessionService.set(phoneNumber, {
          userId,
          state: 'AWAITING_CONFIRMATION',
          intent: 'ADD_EXPENSE',
          pending_action: 'CONFIRM_DUPLICATE',
          data: {
            draft: draftState
          }
        });

        return 'A similar expense was added in the last few minutes. Save anyway? (yes/no)';
      }

      await this.sessionService.clear(phoneNumber);
      return this.completeDraft(userId, userName, phoneNumber, groupId, draftState);
    } catch (error) {
      logger.error({
        message: 'Failed to process ADD_EXPENSE',
        from: phoneNumber,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return fallbackExpenseMessage;
    }
  }

  private async completeDraft(
    userId: string,
    userName: string,
    phoneNumber: string,
    groupId: string,
    draftState: DraftState
  ): Promise<string> {
    const draft = toExpenseDraft(draftState);
    if (!draft) {
      return fallbackExpenseMessage;
    }

    try {
      const validation = this.validationService.validateExpenseDraft(userName, draft);
      if (!validation.success) {
        return fallbackExpenseMessage;
      }

      const groupMembers = await this.groupService.getMembers(groupId);
      const participantByName = new Map(
        groupMembers.map((member) => [member.name.toLowerCase(), member])
      );

      for (const name of draft.participants) {
        if (!participantByName.has(name.toLowerCase())) {
          const created = await this.userRepository.createByName(name);
          await this.groupService.addMemberToGroup(groupId, created.id);
          participantByName.set(created.name.toLowerCase(), {
            userId: created.id,
            name: created.name,
            aliases: created.aliases ?? []
          });
        }
      }

      const expense = await this.expenseRepository.createExpense({
        payerId: userId,
        amount: draft.total,
        participants: draft.participants.length,
        category: draft.category
      });

      logger.info({
        message: 'DB operation',
        operation: 'createExpense',
        expenseId: expense.id,
        from: phoneNumber,
        total: draft.total
      });

      const lines: string[] = [];

      for (const [participantName, amount] of Object.entries(draft.split)) {
        const participant = participantByName.get(participantName.toLowerCase());
        if (!participant || amount <= 0) {
          continue;
        }

        const split = await this.splitRepository.createSplit({
          expenseId: expense.id,
          userId: participant.userId,
          amount
        });

        logger.info({
          message: 'DB operation',
          operation: 'createSplit',
          splitId: split.id,
          participantName: participant.name,
          amount
        });

        if (participant.userId !== userId) {
          lines.push(`${participant.name} owes ${userName}: ₹${formatCurrency(amount)}`);
        }
      }

      const header = `Expense added: ₹${formatCurrency(draft.total)}`;
      if (lines.length === 0) {
        return header;
      }

      return `${header}\n\n${lines.join('\n')}`;
    } catch (error) {
      logger.error({
        message: 'DB failure while saving expense',
        from: phoneNumber,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return 'Could not save the expense right now. Please try again.';
    }
  }

  private async handleReceivable(userId: string): Promise<string> {
    try {
      const receivables = await this.financialService.getReceivables(userId);
      if (receivables.size === 0) {
        return 'No one owes you anything.';
      }

      const lines = ['People who owe you:', ''];
      for (const [name, amount] of receivables.entries()) {
        lines.push(`${name} owes you ₹${formatCurrency(amount)}`);
      }

      return lines.join('\n');
    } catch (error) {
      logger.error({
        message: 'Failed to fetch receivables',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return fallbackBalanceMessage;
    }
  }

  private async handlePayable(userId: string): Promise<string> {
    try {
      const payables = await this.financialService.getPayables(userId);
      if (payables.size === 0) {
        return 'You do not owe anything.';
      }

      const lines = ['You owe:', ''];
      for (const [name, amount] of payables.entries()) {
        lines.push(`You owe ${name} ₹${formatCurrency(amount)}`);
      }

      return lines.join('\n');
    } catch (error) {
      logger.error({
        message: 'Failed to fetch payables',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return fallbackBalanceMessage;
    }
  }

  private async handleNetBalance(userId: string): Promise<string> {
    try {
      const net = await this.financialService.getNetBalance(userId);
      if (net.length === 0) {
        return 'No balances to show.';
      }

      const lines = ['Balances:', ''];
      for (const item of net) {
        if (item.direction === 'owe_you') {
          lines.push(`${item.counterpartyName} owes you ₹${formatCurrency(item.amount)}`);
        } else {
          lines.push(`You owe ${item.counterpartyName} ₹${formatCurrency(item.amount)}`);
        }
      }

      return lines.join('\n');
    } catch (error) {
      logger.error({
        message: 'Failed to fetch net balances',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return fallbackBalanceMessage;
    }
  }

  private async handleSimplifyDebts(userId: string): Promise<string> {
    try {
      const steps = await this.financialService.getSimplifiedSettlements(userId);
      if (steps.length === 0) {
        return 'Nothing to settle up.';
      }

      const lines = ['Settle up:', ''];
      for (const step of steps) {
        lines.push(`${step.fromUserName} pays ${step.toUserName} ₹${formatCurrency(step.amount)}`);
      }

      return lines.join('\n');
    } catch (error) {
      logger.error({
        message: 'Failed to simplify debts',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return fallbackBalanceMessage;
    }
  }
}
