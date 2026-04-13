import { normalizePersonName } from './normalization';

export interface KnownUserRef {
  id: string;
  name: string;
}

export interface ParticipantExtractionResult {
  participants: string[];
  unknownParticipants: string[];
}

const fillerTokens = new Set([
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

const fuzzyMatch = (candidate: string, knownUsers: KnownUserRef[]): string | null => {
  const lower = candidate.toLowerCase();

  const exact = knownUsers.find((user) => user.name.toLowerCase() === lower);
  if (exact) {
    return exact.name;
  }

  const prefix = knownUsers.find((user) => user.name.toLowerCase().startsWith(lower) || lower.startsWith(user.name.toLowerCase()));
  if (prefix) {
    return prefix.name;
  }

  return null;
};

export const extractParticipants = (
  cleanedText: string,
  senderName: string,
  knownUsers: KnownUserRef[]
): ParticipantExtractionResult => {
  const replacedSelf = cleanedText.replace(/\b(me|myself|i)\b/gi, senderName);

  const tokens = replacedSelf
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => !fillerTokens.has(token.toLowerCase()));

  const participantsMap = new Map<string, string>();
  const unknownMap = new Map<string, string>();

  for (const token of tokens) {
    const normalized = normalizePersonName(token);
    if (!normalized) {
      continue;
    }

    const matched = fuzzyMatch(normalized, knownUsers);
    if (matched) {
      participantsMap.set(matched.toLowerCase(), matched);
    } else {
      unknownMap.set(normalized.toLowerCase(), normalized);
    }
  }

  if (/\b(everyone|all|us|we)\b/i.test(cleanedText)) {
    for (const user of knownUsers) {
      participantsMap.set(user.name.toLowerCase(), user.name);
    }
    participantsMap.set(senderName.toLowerCase(), senderName);
  }

  const participants = Array.from(participantsMap.values());
  const unknownParticipants = Array.from(unknownMap.values()).filter(
    (name) => !participantsMap.has(name.toLowerCase())
  );

  return { participants, unknownParticipants };
};
