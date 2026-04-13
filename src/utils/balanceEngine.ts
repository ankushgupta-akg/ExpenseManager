import { SplitWithRelations } from '../repositories/split.repository';

export interface LedgerTransaction {
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  amount: number;
}

export interface SettlementStep {
  fromUserName: string;
  toUserName: string;
  amount: number;
}

const roundToTwo = (value: number): number => Math.round(value * 100) / 100;

export const buildTransactionsFromSplits = (splits: SplitWithRelations[]): LedgerTransaction[] => {
  const transactions: LedgerTransaction[] = [];

  for (const split of splits) {
    const payer = split.expense.payer;
    const participant = split.user;

    if (participant.id === payer.id || split.amount <= 0) {
      continue;
    }

    transactions.push({
      fromUserId: participant.id,
      fromUserName: participant.name,
      toUserId: payer.id,
      toUserName: payer.name,
      amount: roundToTwo(split.amount)
    });
  }

  return transactions;
};

export const computeReceivables = (
  userId: string,
  transactions: LedgerTransaction[]
): Map<string, number> => {
  const receivables = new Map<string, number>();

  for (const transaction of transactions) {
    if (transaction.toUserId !== userId) {
      continue;
    }

    const current = receivables.get(transaction.fromUserName) ?? 0;
    receivables.set(transaction.fromUserName, roundToTwo(current + transaction.amount));
  }

  return receivables;
};

export const computePayables = (
  userId: string,
  transactions: LedgerTransaction[]
): Map<string, number> => {
  const payables = new Map<string, number>();

  for (const transaction of transactions) {
    if (transaction.fromUserId !== userId) {
      continue;
    }

    const current = payables.get(transaction.toUserName) ?? 0;
    payables.set(transaction.toUserName, roundToTwo(current + transaction.amount));
  }

  return payables;
};

export const computeNetForUser = (
  userId: string,
  userName: string,
  transactions: LedgerTransaction[]
): Array<{ counterpartyName: string; amount: number; direction: 'owe_you' | 'you_owe' }> => {
  const net = new Map<string, number>();

  for (const transaction of transactions) {
    if (transaction.toUserId === userId) {
      const current = net.get(transaction.fromUserName) ?? 0;
      net.set(transaction.fromUserName, roundToTwo(current + transaction.amount));
    }

    if (transaction.fromUserId === userId) {
      const current = net.get(transaction.toUserName) ?? 0;
      net.set(transaction.toUserName, roundToTwo(current - transaction.amount));
    }
  }

  const result: Array<{ counterpartyName: string; amount: number; direction: 'owe_you' | 'you_owe' }> = [];

  for (const [counterpartyName, amount] of net.entries()) {
    if (counterpartyName === userName || amount === 0) {
      continue;
    }

    if (amount > 0) {
      result.push({ counterpartyName, amount: roundToTwo(amount), direction: 'owe_you' });
    } else {
      result.push({ counterpartyName, amount: roundToTwo(Math.abs(amount)), direction: 'you_owe' });
    }
  }

  return result;
};

export const simplifyDebts = (transactions: LedgerTransaction[]): SettlementStep[] => {
  const netByUserId = new Map<string, { name: string; balance: number }>();

  for (const transaction of transactions) {
    const debtor = netByUserId.get(transaction.fromUserId) ?? {
      name: transaction.fromUserName,
      balance: 0
    };
    debtor.balance = roundToTwo(debtor.balance - transaction.amount);
    netByUserId.set(transaction.fromUserId, debtor);

    const creditor = netByUserId.get(transaction.toUserId) ?? {
      name: transaction.toUserName,
      balance: 0
    };
    creditor.balance = roundToTwo(creditor.balance + transaction.amount);
    netByUserId.set(transaction.toUserId, creditor);
  }

  const creditors = Array.from(netByUserId.values())
    .filter((entry) => entry.balance > 0)
    .map((entry) => ({ ...entry, balance: roundToTwo(entry.balance) }))
    .sort((a, b) => b.balance - a.balance);

  const debtors = Array.from(netByUserId.values())
    .filter((entry) => entry.balance < 0)
    .map((entry) => ({ ...entry, balance: roundToTwo(Math.abs(entry.balance)) }))
    .sort((a, b) => b.balance - a.balance);

  const settlements: SettlementStep[] = [];

  let creditorIndex = 0;
  let debtorIndex = 0;

  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex] as { name: string; balance: number };
    const debtor = debtors[debtorIndex] as { name: string; balance: number };

    const settled = roundToTwo(Math.min(creditor.balance, debtor.balance));

    if (settled > 0) {
      settlements.push({
        fromUserName: debtor.name,
        toUserName: creditor.name,
        amount: settled
      });

      creditor.balance = roundToTwo(creditor.balance - settled);
      debtor.balance = roundToTwo(debtor.balance - settled);
    }

    if (creditor.balance === 0) {
      creditorIndex += 1;
    }

    if (debtor.balance === 0) {
      debtorIndex += 1;
    }
  }

  return settlements;
};
