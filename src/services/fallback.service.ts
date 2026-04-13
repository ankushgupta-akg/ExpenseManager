import { fallbackFromNormalizedInput, sanitizeSplitMap } from '../utils/expenseFallback';

export interface FallbackInput {
  participants: string[];
  explicitAmountSplits: Record<string, number>;
  explicitPercentSplits: Record<string, number>;
  total: number;
}

export class FallbackService {
  public buildValidSplit(input: FallbackInput): Record<string, number> {
    return fallbackFromNormalizedInput({
      names: input.participants,
      explicitAmountSplits: sanitizeSplitMap(input.explicitAmountSplits),
      explicitPercentSplits: input.explicitPercentSplits,
      total: input.total
    });
  }
}
