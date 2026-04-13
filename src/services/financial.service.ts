import {
  buildTransactionsFromSplits,
  computeNetForUser,
  computePayables,
  computeReceivables,
  simplifyDebts
} from '../utils/balanceEngine';
import { ExpenseRepository } from '../repositories/expense.repository';
import { SplitRepository } from '../repositories/split.repository';
import { UserRepository } from '../repositories/user.repository';

export class FinancialService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly expenseRepository: ExpenseRepository,
    private readonly splitRepository: SplitRepository
  ) {}

  public async getReceivables(userId: string): Promise<Map<string, number>> {
    const { transactions } = await this.loadTransactions(userId);
    return computeReceivables(userId, transactions);
  }

  public async getPayables(userId: string): Promise<Map<string, number>> {
    const { transactions } = await this.loadTransactions(userId);
    return computePayables(userId, transactions);
  }

  public async getNetBalance(userId: string): Promise<Array<{ counterpartyName: string; amount: number; direction: 'owe_you' | 'you_owe' }>> {
    const { currentUserName, transactions } = await this.loadTransactions(userId);
    return computeNetForUser(userId, currentUserName, transactions);
  }

  public async getSimplifiedSettlements(userId: string): Promise<Array<{ fromUserName: string; toUserName: string; amount: number }>> {
    const { transactions } = await this.loadTransactions(userId);
    return simplifyDebts(transactions);
  }

  private async loadTransactions(userId: string): Promise<{ currentUserName: string; transactions: ReturnType<typeof buildTransactionsFromSplits> }> {
    const currentUser = (await this.userRepository.listAllUsers()).find((item) => item.id === userId);

    if (!currentUser) {
      throw new Error('User not found');
    }

    const expenseIds = await this.expenseRepository.findExpenseIdsByUserInvolvement(currentUser.id);
    const splits = await this.splitRepository.findSplitsByExpenseIds(expenseIds);

    return {
      currentUserName: currentUser.name,
      transactions: buildTransactionsFromSplits(splits)
    };
  }
}
