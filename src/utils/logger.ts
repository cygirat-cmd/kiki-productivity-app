const redact = (value: unknown): unknown => {
  if (typeof value === 'string') {
    return value.replace(/(access|refresh)_token[^\s]*/gi, '[REDACTED]');
  }
  if (Array.isArray(value)) {
    return value.map(redact);
  }
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, val]) =>
        /token|session/i.test(key) ? [key, '[REDACTED]'] : [key, redact(val)]
      )
    );
  }
  return value;
};

const log = (method: 'debug' | 'info' | 'warn' | 'error') => (
  ...args: unknown[]
) => {
  if (method === 'debug' && !import.meta.env.DEV) return;
  console[method](...args.map(redact));
};

export const logger = {
  debug: log('debug'),
  info: log('info'),
  warn: log('warn'),
  error: log('error'),
};

export default logger;
