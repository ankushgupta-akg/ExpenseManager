import { ExpenseRepository } from '../repositories/expense.repository';

export interface DuplicateCheckInput {
  payerId: string;
  total: number;
  participantIds: string[];
}

export class DuplicateService {
  constructor(private readonly expenseRepository: ExpenseRepository) {}

  public async isLikelyDuplicate(input: DuplicateCheckInput): Promise<boolean> {
    const recent = await this.expenseRepository.findRecentByPayer(input.payerId, 5);

    const participantKey = input.participantIds.slice().sort().join('|');

    return recent.some((expense) => {
      const amountClose = Math.abs(expense.amount - input.total) < 0.01;
      const participants = expense.splits.map((split) => split.userId).sort().join('|');
      return amountClose && participants === participantKey;
    });
  }
}
