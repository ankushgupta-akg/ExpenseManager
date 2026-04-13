import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const toPositiveInt = (name: string) =>
  z.string().transform((value, ctx) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${name} must be a positive integer` });
      return z.NEVER;
    }
    return parsed;
  });

const envSchema = z.object({
  PORT: toPositiveInt('PORT').default('3000'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  GROQ_API_KEY: z.string().min(1, 'GROQ_API_KEY is required'),
  GROQ_MODEL: z.string().min(1).default('llama3-8b-8192'),
  AI_TIMEOUT_MS: toPositiveInt('AI_TIMEOUT_MS').default('10000'),
  AI_MAX_RETRIES: z.string().default('2').transform((value, ctx) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'AI_MAX_RETRIES must be an integer between 0 and 2'
      });
      return z.NEVER;
    }
    return parsed;
  }),
  RATE_LIMIT_MAX_REQUESTS: toPositiveInt('RATE_LIMIT_MAX_REQUESTS').default('100'),
  RATE_LIMIT_WINDOW_MS: toPositiveInt('RATE_LIMIT_WINDOW_MS').default('60000'),
  REDIS_URL: z.string().default(''),
  SESSION_TTL_SECONDS: toPositiveInt('SESSION_TTL_SECONDS').default('300'),
  USER_LOCK_TTL_MS: toPositiveInt('USER_LOCK_TTL_MS').default('15000')
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
    .join('; ');
  throw new Error(`Invalid environment variables: ${issues}`);
}

export const env = parsed.data;
