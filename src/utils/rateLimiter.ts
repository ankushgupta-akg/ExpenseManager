import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { logger } from './logger';

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&apos;');

const twimlMessage = (message: string): string =>
  `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`;

export const rateLimiter = (req: Request, res: Response, next: NextFunction): void => {
  const now = Date.now();
  const sender = typeof req.body?.From === 'string' && req.body.From.length > 0 ? req.body.From : req.ip;
  const key = sender || 'unknown';

  const existing = buckets.get(key);
  if (!existing || now >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + env.RATE_LIMIT_WINDOW_MS });
    next();
    return;
  }

  if (existing.count >= env.RATE_LIMIT_MAX_REQUESTS) {
    logger.error({
      message: 'Rate limit exceeded',
      key,
      count: existing.count,
      resetAt: existing.resetAt
    });

    res.status(429).type('text/xml').send(twimlMessage('Rate limit exceeded. Please try again later.'));
    return;
  }

  existing.count += 1;
  buckets.set(key, existing);
  next();
};
