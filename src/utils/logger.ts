type LogLevel = 'info' | 'error';

interface LogPayload {
  message: string;
  [key: string]: unknown;
}

const log = (level: LogLevel, payload: LogPayload): void => {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    ...payload
  };

  if (level === 'error') {
    console.error(JSON.stringify(entry));
    return;
  }

  console.log(JSON.stringify(entry));
};

export const logger = {
  info: (payload: LogPayload): void => log('info', payload),
  error: (payload: LogPayload): void => log('error', payload)
};
