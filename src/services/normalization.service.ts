import {
  NormalizedInput,
  extractCategory,
  extractPrimaryAmount,
  normalizeInput,
  normalizePersonName
} from '../utils/normalization';

export interface NormalizedExpenseContext {
  normalized: NormalizedInput;
  primaryAmount: number | null;
  category: string;
}

export class NormalizationService {
  public normalizeExpenseText(text: string, senderName: string): NormalizedExpenseContext {
    const normalized = normalizeInput(text, senderName);

    return {
      normalized,
      primaryAmount: extractPrimaryAmount(normalized),
      category: extractCategory(text)
    };
  }

  public normalizeName(name: string): string | null {
    return normalizePersonName(name);
  }
}
