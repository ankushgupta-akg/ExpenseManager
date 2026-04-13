import { normalizePersonName } from '../utils/normalization';

export interface GroupMemberRef {
  userId: string;
  name: string;
  aliases: string[];
}

export interface AmbiguousParticipant {
  token: string;
  options: string[];
}

export interface ParticipantResolutionResult {
  resolvedNames: string[];
  unknownNames: string[];
  ambiguous: AmbiguousParticipant[];
}

const blockedTokens = new Set([
  'split',
  'between',
  'among',
  'and',
  'with',
  'for',
  'paid',
  'pay',
  'equal',
  'equally',
  'expense',
  'total'
]);

const levenshtein = (a: string, b: string): number => {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i += 1) {
    dp[i]![0] = i;
  }
  for (let j = 0; j <= n; j += 1) {
    dp[0]![j] = j;
  }

  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const del = dp[i - 1]![j]! + 1;
      const ins = dp[i]![j - 1]! + 1;
      const sub = dp[i - 1]![j - 1]! + cost;
      dp[i]![j] = Math.min(del, ins, sub);
    }
  }

  return dp[m]![n]!;
};

const distanceRatio = (a: string, b: string): number => {
  if (a.length === 0 && b.length === 0) {
    return 0;
  }

  return levenshtein(a, b) / Math.max(a.length, b.length);
};

const tokenize = (text: string): string[] => {
  return text
    .replace(/[^A-Za-z\s]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
    .filter((token) => !blockedTokens.has(token.toLowerCase()));
};

export class ParticipantService {
  public resolveParticipants(
    text: string,
    senderName: string,
    groupMembers: GroupMemberRef[]
  ): ParticipantResolutionResult {
    const expanded = text.replace(/\b(me|myself|i)\b/gi, senderName);
    const includeEveryone = /\b(everyone|all|us|we)\b/i.test(expanded);

    const memberMap = new Map<string, string>();
    for (const member of groupMembers) {
      memberMap.set(member.name.toLowerCase(), member.name);
      for (const alias of member.aliases) {
        memberMap.set(alias.toLowerCase(), member.name);
      }
    }

    if (includeEveryone) {
      return {
        resolvedNames: Array.from(new Set(groupMembers.map((member) => member.name))),
        unknownNames: [],
        ambiguous: []
      };
    }

    const tokens = tokenize(expanded);
    const resolved = new Map<string, string>();
    const unknown = new Map<string, string>();
    const ambiguous: AmbiguousParticipant[] = [];

    for (const token of tokens) {
      const normalized = normalizePersonName(token);
      if (!normalized) {
        continue;
      }

      const exact = memberMap.get(normalized.toLowerCase());
      if (exact) {
        resolved.set(exact.toLowerCase(), exact);
        continue;
      }

      const candidates: Array<{ name: string; ratio: number }> = [];
      for (const member of groupMembers) {
        const ratio = distanceRatio(normalized.toLowerCase(), member.name.toLowerCase());
        candidates.push({ name: member.name, ratio });
      }

      candidates.sort((a, b) => a.ratio - b.ratio);
      const best = candidates[0];
      const second = candidates[1];

      if (!best) {
        unknown.set(normalized.toLowerCase(), normalized);
        continue;
      }

      if (best.ratio < 0.3) {
        resolved.set(best.name.toLowerCase(), best.name);
        continue;
      }

      if (best.ratio <= 0.6) {
        const options = [best.name];
        if (second && second.ratio <= 0.6) {
          options.push(second.name);
        }

        ambiguous.push({
          token: normalized,
          options: Array.from(new Set(options))
        });
        continue;
      }

      unknown.set(normalized.toLowerCase(), normalized);
    }

    if (!resolved.has(senderName.toLowerCase()) && /\b(me|myself|i)\b/i.test(text)) {
      resolved.set(senderName.toLowerCase(), senderName);
    }

    return {
      resolvedNames: Array.from(resolved.values()),
      unknownNames: Array.from(unknown.values()),
      ambiguous
    };
  }
}
