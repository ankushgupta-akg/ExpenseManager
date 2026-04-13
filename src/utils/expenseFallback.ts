const blockedNames = new Set(['user', 'sender', 'you', 'me', 'myself', 'i', 'contact', 'everyone', 'all', 'us', 'we']);
const fillerWords = new Set(['split', 'between', 'among', 'and', 'to', 'with', 'for', 'equally', 'equal', 'paid', 'spent', 'bought', 'add', 'expense', 'total', 'pay', 'pays', 'owes', 'the', 'rest', 'only', 'was', 'is']);

const roundToTwo = (value: number): number => Math.round(value * 100) / 100;

const toTitleCase = (value: string): string =>
  value
    .split(' ')
    .filter((part) => part.length > 0)
    .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1).toLowerCase()}`)
    .join(' ');

const splitEqually = (names: string[], total: number): Record<string, number> => {
  if (names.length === 0) {
    return {};
  }

  const totalCents = Math.round(total * 100);
  const baseCents = Math.floor(totalCents / names.length);
  let remainder = totalCents - baseCents * names.length;

  const split: Record<string, number> = {};

  for (const name of names) {
    const cents = baseCents + (remainder > 0 ? 1 : 0);
    if (remainder > 0) {
      remainder -= 1;
    }

    split[name] = roundToTwo(cents / 100);
  }

  return split;
};

const normalizeCurrencyToken = (value: string): number | null => {
  const cleaned = value.replace(/[,₹$£€inrINRrsRS\s]/g, '');
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return roundToTwo(parsed);
};

export interface NormalizedExpenseInput {
  normalizedText: string;
  participantNames: string[];
  explicitAmountSplits: Record<string, number>;
  explicitPercentSplits: Record<string, number>;
  hasSelfReference: boolean;
  isEqualSplitHint: boolean;
}

export const normalizeDisplayName = (value: string): string | null => {
  const cleaned = value
    .replace(/[^a-zA-Z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) {
    return null;
  }

  const lower = cleaned.toLowerCase();
  if (blockedNames.has(lower) || fillerWords.has(lower)) {
    return null;
  }

  return toTitleCase(cleaned);
};

export const sanitizeCategory = (value: string | undefined): string => {
  const cleaned = (value ?? '').trim();
  return cleaned.length > 0 ? cleaned.toLowerCase() : 'misc';
};

export const sanitizeSplitMap = (split: Record<string, number>): Record<string, number> => {
  const merged = new Map<string, { name: string; amount: number }>();

  for (const [rawName, rawAmount] of Object.entries(split)) {
    const name = normalizeDisplayName(rawName);
    const amount = Number(rawAmount);

    if (!name || !Number.isFinite(amount) || amount <= 0) {
      continue;
    }

    const key = name.toLowerCase();
    const current = merged.get(key);

    if (!current) {
      merged.set(key, { name, amount: roundToTwo(amount) });
    } else {
      current.amount = roundToTwo(current.amount + amount);
      merged.set(key, current);
    }
  }

  return Object.fromEntries(Array.from(merged.values()).map((entry) => [entry.name, entry.amount]));
};

export const extractTotalFromText = (text: string): number | null => {
  const matches = text.match(/[₹$£€]?\s*\d[\d,]*(?:\.\d+)?/g);

  if (!matches || matches.length === 0) {
    return null;
  }

  for (const token of matches) {
    const parsed = normalizeCurrencyToken(token);
    if (parsed) {
      return parsed;
    }
  }

  return null;
};

export const extractCategoryFromText = (text: string): string => {
  const forMatch = text.match(/\bfor\s+([a-zA-Z\s]+)/i);
  if (forMatch?.[1]) {
    return sanitizeCategory(forMatch[1]);
  }

  return 'misc';
};

const dedupeNames = (names: string[]): string[] => {
  const unique = new Map<string, string>();

  for (const name of names) {
    const normalized = normalizeDisplayName(name);
    if (!normalized) {
      continue;
    }

    const key = normalized.toLowerCase();
    if (!unique.has(key)) {
      unique.set(key, normalized);
    }
  }

  return Array.from(unique.values());
};

export const normalizeExpenseInput = (text: string, payerName: string): NormalizedExpenseInput => {
  const normalizedText = text.trim().toLowerCase().replace(/\s+/g, ' ');
  const hasSelfReference = /\b(me|myself|i)\b/i.test(text);
  const isEqualSplitHint = /(split|among|between|equally|equal|everyone|all|us|we)/i.test(text);

  const expanded = text.replace(/\b(me|myself|i)\b/gi, payerName);

  const explicitAmountSplits: Record<string, number> = {};
  const explicitPercentSplits: Record<string, number> = {};

  const amountPattern = /([A-Za-z][A-Za-z\s]{0,30}?)\s*(?:pays?|paid|owes?)?\s*[:=\-]?\s*([₹$£€]?\s*\d[\d,]*(?:\.\d+)?)(?!\s*%)/g;
  let amountMatch: RegExpExecArray | null = amountPattern.exec(expanded);

  while (amountMatch) {
    const name = normalizeDisplayName(amountMatch[1] ?? '');
    const amount = normalizeCurrencyToken(amountMatch[2] ?? '');

    if (name && amount && amount > 0) {
      explicitAmountSplits[name] = roundToTwo((explicitAmountSplits[name] ?? 0) + amount);
    }

    amountMatch = amountPattern.exec(expanded);
  }

  const percentPattern = /([A-Za-z][A-Za-z\s]{0,30}?)\s*(?:pays?|paid|owes?)?\s*[:=\-]?\s*(\d+(?:\.\d+)?)\s*%/g;
  let percentMatch: RegExpExecArray | null = percentPattern.exec(expanded);

  while (percentMatch) {
    const name = normalizeDisplayName(percentMatch[1] ?? '');
    const pct = Number(percentMatch[2]);

    if (name && Number.isFinite(pct) && pct > 0) {
      explicitPercentSplits[name] = roundToTwo((explicitPercentSplits[name] ?? 0) + pct);
    }

    percentMatch = percentPattern.exec(expanded);
  }

  const candidateRegion = expanded
    .replace(/[,:]/g, ' ')
    .replace(/[₹$£€]?\s*\d[\d,]*(?:\.\d+)?\s*%?/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const tokens = candidateRegion.split(/\s+/).filter(Boolean);
  const namesFromTokens: string[] = [];

  for (const token of tokens) {
    const lower = token.toLowerCase();
    if (fillerWords.has(lower)) {
      continue;
    }

    const normalized = normalizeDisplayName(token);
    if (normalized) {
      namesFromTokens.push(normalized);
    }
  }

  const participantNames = dedupeNames([
    ...namesFromTokens,
    ...Object.keys(explicitAmountSplits),
    ...Object.keys(explicitPercentSplits)
  ]);

  if ((hasSelfReference || isEqualSplitHint) && !participantNames.some((name) => name.toLowerCase() === payerName.toLowerCase())) {
    participantNames.push(payerName);
  }

  return {
    normalizedText,
    participantNames: dedupeNames(participantNames),
    explicitAmountSplits: sanitizeSplitMap(explicitAmountSplits),
    explicitPercentSplits,
    hasSelfReference,
    isEqualSplitHint
  };
};

export const fallbackFromNormalizedInput = (input: {
  names: string[];
  explicitAmountSplits: Record<string, number>;
  explicitPercentSplits: Record<string, number>;
  total: number;
}): Record<string, number> => {
  const total = roundToTwo(input.total);
  if (!Number.isFinite(total) || total <= 0) {
    return {};
  }

  const names = dedupeNames(input.names);
  if (names.length === 0) {
    return {};
  }

  const amountSplits = sanitizeSplitMap(input.explicitAmountSplits);
  const percentSplits = input.explicitPercentSplits;

  const final: Record<string, number> = {};

  for (const name of names) {
    if (amountSplits[name] && amountSplits[name] > 0) {
      final[name] = roundToTwo(amountSplits[name]);
    }
  }

  const amountSum = roundToTwo(Object.values(final).reduce((sum, value) => sum + value, 0));
  if (amountSum > total) {
    return {};
  }

  let remaining = roundToTwo(total - amountSum);

  if (remaining > 0) {
    const percentTargets = names.filter((name) => percentSplits[name] && percentSplits[name] > 0 && final[name] === undefined);

    if (percentTargets.length > 0) {
      const percentTotal = percentTargets.reduce((sum, name) => sum + (percentSplits[name] ?? 0), 0);

      if (percentTotal > 0) {
        let allocated = 0;

        for (let index = 0; index < percentTargets.length; index += 1) {
          const name = percentTargets[index] as string;

          if (index === percentTargets.length - 1) {
            const value = roundToTwo(remaining - allocated);
            if (value > 0) {
              final[name] = value;
            }
            break;
          }

          const ratio = (percentSplits[name] ?? 0) / percentTotal;
          const value = roundToTwo(remaining * ratio);
          if (value > 0) {
            final[name] = value;
            allocated = roundToTwo(allocated + value);
          }
        }

        remaining = roundToTwo(total - Object.values(final).reduce((sum, value) => sum + value, 0));
      }
    }
  }

  if (remaining > 0) {
    const pending = names.filter((name) => final[name] === undefined);

    if (pending.length > 0) {
      const equalRest = splitEqually(pending, remaining);
      Object.assign(final, equalRest);
      remaining = roundToTwo(total - Object.values(final).reduce((sum, value) => sum + value, 0));
    }
  }

  if (remaining !== 0) {
    const keys = Object.keys(final);
    if (keys.length > 0) {
      const last = keys[keys.length - 1] as string;
      final[last] = roundToTwo((final[last] ?? 0) + remaining);
    }
  }

  return sanitizeSplitMap(final);
};
