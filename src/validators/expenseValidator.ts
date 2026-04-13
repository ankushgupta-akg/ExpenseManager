import { z } from 'zod';

const roundToTwo = (value: number): number => Math.round(value * 100) / 100;

export const rawExpenseSchema = z.object({
  payer: z.string().trim().min(1),
  total: z.number().positive(),
  category: z.string().trim().min(1),
  split: z.record(z.string(), z.number())
});

export const expenseSchema = z.object({
  payer: z.string().trim().min(1),
  total: z.number().positive(),
  category: z.string().trim().min(1),
  split: z.record(z.string().trim().min(1), z.number().positive())
}).superRefine((value, ctx) => {
  const splitEntries = Object.entries(value.split);

  if (splitEntries.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'split must contain at least one participant',
      path: ['split']
    });
    return;
  }

  const splitSum = roundToTwo(splitEntries.reduce((sum, [, amount]) => sum + amount, 0));
  const total = roundToTwo(value.total);

  if (splitSum !== total) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `sum(split) must equal total (expected ${total}, received ${splitSum})`,
      path: ['split']
    });
  }
});

export type ExpenseInput = z.infer<typeof expenseSchema>;
