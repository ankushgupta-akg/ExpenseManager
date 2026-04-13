const fillerWords = new Set([
  'split',
  'between',
  'among',
  'and',
  'to',
  'with',
  'for',
  'equally',
  'equal',
  'paid',
  'spent',
  'bought',
  'add',
  'expense',
  'total',
  'pay',
  'pays',
  'owes',
  'the',
  'rest',
  'only',
  'was',
  'is'
]);

const roundToTwo = (value: number): number => Math.round(value * 100) / 100;

export interface NormalizedInput {
  originalText: string;
  normalizedText: string;
  cleanedText: string;
  extractedNumbers: number[];
  explicitAmountSplits: Record<string, number>;
  explicitPercentSplits: Record<string, number>;
  hasSelfReference: boolean;
  hasEqualSplitHint: boolean;
}

const normalizeCurrencyToken = (value: string): number | null => {
  const cleaned = value.replace(/[,₹$£€inrINRrsRS\s]/g, '');
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return roundToTwo(parsed);
};

const titleCase = (value: string): string =>
  value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1).toLowerCase()}`)
    .join(' ');

const cleanName = (value: string): string | null => {
  const cleaned = value.replace(/[^A-Za-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) {
    return null;
  }

  const lower = cleaned.toLowerCase();
  if (fillerWords.has(lower)) {
    return null;
  }

  return titleCase(cleaned);
};

export const normalizeInput = (text: string, senderName: string): NormalizedInput => {
  const originalText = text;
  const normalizedText = text.trim().toLowerCase().replace(/\s+/g, ' ');
  const hasSelfReference = /\b(me|myself|i)\b/i.test(text);
  const hasEqualSplitHint = /\b(split|among|between|equally|equal|everyone|all|us|we)\b/i.test(text);

  const replaced = text.replace(/\b(me|myself|i)\b/gi, senderName);

  const explicitAmountSplits: Record<string, number> = {};
  const explicitPercentSplits: Record<string, number> = {};

  const amountPattern = /([A-Za-z][A-Za-z\s]{0,30}?)\s*(?:pays?|paid|owes?)?\s*[:=\-]?\s*([₹$£€]?\s*\d[\d,]*(?:\.\d+)?)(?!\s*%)/g;
  let amountMatch: RegExpExecArray | null = amountPattern.exec(replaced);

  while (amountMatch) {
    const name = cleanName(amountMatch[1] ?? '');
    const amount = normalizeCurrencyToken(amountMatch[2] ?? '');

    if (name && amount && amount > 0) {
      explicitAmountSplits[name] = roundToTwo((explicitAmountSplits[name] ?? 0) + amount);
    }

    amountMatch = amountPattern.exec(replaced);
  }

  const percentPattern = /([A-Za-z][A-Za-z\s]{0,30}?)\s*(?:pays?|paid|owes?)?\s*[:=\-]?\s*(\d+(?:\.\d+)?)\s*%/g;
  let percentMatch: RegExpExecArray | null = percentPattern.exec(replaced);

  while (percentMatch) {
    const name = cleanName(percentMatch[1] ?? '');
    const pct = Number(percentMatch[2]);

    if (name && Number.isFinite(pct) && pct > 0) {
      explicitPercentSplits[name] = roundToTwo((explicitPercentSplits[name] ?? 0) + pct);
    }

    percentMatch = percentPattern.exec(replaced);
  }

  const numberMatches = replaced.match(/[₹$£€]?\s*\d[\d,]*(?:\.\d+)?/g) ?? [];
  const extractedNumbers = numberMatches
    .map((token) => normalizeCurrencyToken(token))
    .filter((value): value is number => value !== null);

  const cleanedText = replaced
    .replace(/[,:]/g, ' ')
    .replace(/[₹$£€]?\s*\d[\d,]*(?:\.\d+)?\s*%?/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    originalText,
    normalizedText,
    cleanedText,
    extractedNumbers,
    explicitAmountSplits,
    explicitPercentSplits,
    hasSelfReference,
    hasEqualSplitHint
  };
};

export const normalizePersonName = (name: string): string | null => cleanName(name);

export const extractPrimaryAmount = (normalized: NormalizedInput): number | null => {
  if (normalized.extractedNumbers.length === 0) {
    return null;
  }

  return normalized.extractedNumbers[0] ?? null;
};

export const extractCategory = (text: string): string => {
  const forMatch = text.match(/\bfor\s+([a-zA-Z\s]+)/i);
  const raw = (forMatch?.[1] ?? 'misc').trim();
  return raw.length > 0 ? raw.toLowerCase() : 'misc';
};
