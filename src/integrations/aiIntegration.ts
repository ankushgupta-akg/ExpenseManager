import OpenAI from 'openai';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { withTimeout } from '../utils/timeout';

export interface AIAssistContext {
  text: string;
  sender: string;
  knownUsers: string[];
  groupMembers: string[];
  defaultGroup: string[];
  lastExpense?: string;
}

export interface AIAssistResult {
  intent: 'ADD_EXPENSE' | 'UNKNOWN';
  data?: {
    payer: string;
    amount: number;
    participants?: string[];
    split?: Record<string, number>;
    category?: string;
  };
  missing_fields: string[];
  confidence: number;
}

const extractJSONObject = (text: string): string => {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');

  if (start === -1 || end === -1 || start >= end) {
    throw new Error('AI response does not contain a valid JSON object');
  }

  return text.slice(start, end + 1);
};

export class AIIntegration {
  private readonly client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1'
    });
  }

  public async extractExpense(context: AIAssistContext): Promise<AIAssistResult> {
    const completion = await withTimeout(
      this.client.chat.completions.create({
        model: env.GROQ_MODEL,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You are a bounded extractor. Return only JSON with keys intent, data, missing_fields, confidence. intent must be ADD_EXPENSE or UNKNOWN. data must contain payer, amount, participants, split, category when available. Never manage state. Never infer identities beyond provided context. Keep confidence between 0 and 1.'
          },
          {
            role: 'user',
            content: JSON.stringify(context)
          }
        ]
      }),
      env.AI_TIMEOUT_MS
    );

    const content = completion.choices[0]?.message?.content;

    logger.info({
      message: 'AI raw response received',
      rawResponse: content ?? null,
      sender: context.sender
    });

    if (!content) {
      throw new Error('AI response content is empty');
    }

    const jsonCandidate = extractJSONObject(content.trim());

    return JSON.parse(jsonCandidate) as AIAssistResult;
  }
}
