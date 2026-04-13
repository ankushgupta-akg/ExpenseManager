import { IntentService, MessageIntent } from '../services/intent.service';

const service = new IntentService();

export const detectIntent = (text: string): MessageIntent => service.detectIntent(text);

export type { MessageIntent };
