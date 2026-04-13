import { z } from 'zod';

export const whatsappWebhookSchema = z.object({
  Body: z.string().min(1, 'Body is required'),
  From: z.string().min(1, 'From is required')
});

export type WhatsAppWebhookPayload = z.infer<typeof whatsappWebhookSchema>;
