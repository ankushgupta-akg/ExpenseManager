import { AIIntegration, AIAssistContext, AIAssistResult } from '../integrations/aiIntegration';
import { env } from '../config/env';
import { retry } from '../utils/retry';

export class AIService {
  constructor(private readonly integration: AIIntegration) {}

  public async extract(context: AIAssistContext): Promise<AIAssistResult | null> {
    try {
      const result = await retry(() => this.integration.extractExpense(context), {
        maxRetries: Math.max(0, Math.min(env.AI_MAX_RETRIES, 1))
      });

      return result;
    } catch {
      return null;
    }
  }
}
