export type MessageIntent =
  | 'ADD_EXPENSE'
  | 'GET_RECEIVABLE'
  | 'GET_PAYABLE'
  | 'GET_BALANCE'
  | 'SIMPLIFY_DEBTS'
  | 'UNKNOWN';

export class IntentService {
  public detectIntent(text: string): MessageIntent {
    const normalized = text.toLowerCase().trim();

    if (normalized.length === 0) {
      return 'UNKNOWN';
    }

    if (normalized.includes('who owes me') || normalized.includes('owes me')) {
      return 'GET_RECEIVABLE';
    }

    if (normalized.includes('what do i owe') || normalized.includes('do i owe')) {
      return 'GET_PAYABLE';
    }

    if (normalized.includes('show balance') || normalized === 'balance' || normalized === 'balances') {
      return 'GET_BALANCE';
    }

    if (normalized.includes('settle up') || normalized.includes('simplify')) {
      return 'SIMPLIFY_DEBTS';
    }

    return 'ADD_EXPENSE';
  }
}
