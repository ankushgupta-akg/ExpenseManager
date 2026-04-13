import { z } from 'zod';
import { aiAssistSchema } from '../validators/aiAssistValidator';
import { expenseSchema } from '../validators/expenseValidator';

export interface ExpenseDraft {
  total: number;
  category: string;
  split: Record<string, number>;
  participants: string[];
}

const roundToTwo = (value: number): number => Math.round(value * 100) / 100;

export class ValidationService {
  public parseAIAssist(payload: unknown) {
    return aiAssistSchema.safeParse(payload);
  }

  public validateExpenseDraft(payerName: string, draft: ExpenseDraft) {
    return expenseSchema.safeParse({
      payer: payerName,
      total: roundToTwo(draft.total),
      category: draft.category,
      split: draft.split
    });
  }

  public isValidName(value: string): boolean {
    const schema = z
      .string()
      .trim()
      .min(1)
      .max(60)
      .refine((item) => !/^\d+$/.test(item), {
        message: 'name cannot be numeric'
      });

    return schema.safeParse(value).success;
  }
}
