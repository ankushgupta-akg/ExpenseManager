export interface RetryOptions {
  maxRetries: number;
}

export const retry = async <T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> => {
  let lastError: unknown;

  for (let attempt = 0; attempt <= options.maxRetries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === options.maxRetries) {
        break;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Retry failed');
};
