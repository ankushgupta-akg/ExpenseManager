import { Expense } from '@prisma/client';
import { getPrismaClient } from '../integrations/prismaIntegration';

export interface CreateExpenseInput {
  payerId: string;
  amount: number;
  participants: number;
  category: string;
}

export class ExpenseRepository {
  private readonly prisma = getPrismaClient();

  public async createExpense(input: CreateExpenseInput): Promise<Expense> {
    return this.prisma.expense.create({
      data: {
        payerId: input.payerId,
        amount: input.amount,
        participants: input.participants,
        category: input.category
      }
    });
  }

  public async findExpenseIdsByPayerId(payerId: string): Promise<string[]> {
    const expenses = await this.prisma.expense.findMany({
      where: { payerId },
      select: { id: true }
    });

    return expenses.map((expense) => expense.id);
  }

  public async findExpenseIdsByUserInvolvement(userId: string): Promise<string[]> {
    const expenses = await this.prisma.expense.findMany({
      where: {
        OR: [
          { payerId: userId },
          {
            splits: {
              some: {
                userId
              }
            }
          }
        ]
      },
      select: { id: true }
    });

    return expenses.map((expense) => expense.id);
  }

  public async findRecentByPayer(payerId: string, minutes: number): Promise<Array<Expense & { splits: Array<{ userId: string }> }>> {
    const fromTime = new Date(Date.now() - minutes * 60 * 1000);

    return this.prisma.expense.findMany({
      where: {
        payerId,
        createdAt: {
          gte: fromTime
        }
      },
      include: {
        splits: {
          select: {
            userId: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }
}
