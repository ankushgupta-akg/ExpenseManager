import { Prisma, Split } from '@prisma/client';
import { getPrismaClient } from '../integrations/prismaIntegration';

export interface CreateSplitInput {
  expenseId: string;
  userId: string;
  amount: number;
}

const splitWithRelationsArgs = {
  include: {
    user: true,
    expense: {
      include: {
        payer: true
      }
    }
  }
} satisfies Prisma.SplitDefaultArgs;

export type SplitWithRelations = Prisma.SplitGetPayload<typeof splitWithRelationsArgs>;

export class SplitRepository {
  private readonly prisma = getPrismaClient();

  public async createSplit(input: CreateSplitInput): Promise<Split> {
    return this.prisma.split.create({
      data: {
        expenseId: input.expenseId,
        userId: input.userId,
        amount: input.amount
      }
    });
  }

  public async findSplitsByExpenseIds(expenseIds: string[]): Promise<SplitWithRelations[]> {
    if (expenseIds.length === 0) {
      return [];
    }

    return this.prisma.split.findMany({
      where: {
        expenseId: {
          in: expenseIds
        }
      },
      ...splitWithRelationsArgs
    });
  }
}
