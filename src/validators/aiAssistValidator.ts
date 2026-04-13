import { z } from 'zod';

export const aiAssistSchema = z.object({
  intent: z.enum(['ADD_EXPENSE', 'UNKNOWN']),
  data: z.object({
    payer: z.string().min(1),
    amount: z.number().positive(),
    participants: z.array(z.string().min(1)).optional(),
    split: z.record(z.number().positive()).optional(),
    category: z.string().min(1).optional()
  }).optional(),
  missing_fields: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).default(0)
});

export type AIAssist = z.infer<typeof aiAssistSchema>;
