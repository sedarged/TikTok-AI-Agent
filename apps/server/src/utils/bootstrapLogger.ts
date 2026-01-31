import winston from 'winston';

/**
 * Bootstrap logger for use during initialization.
 * This logger doesn't depend on env.ts to avoid circular dependencies.
 * Use this only for logging during env validation or other bootstrap code.
 */
const bootstrapLogger = winston.createLogger({
  level: 'warn',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.simple()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
  ],
});

export function logBootstrapWarn(message: string, meta?: Record<string, unknown>): void {
  bootstrapLogger.warn(message, meta);
}

export function logBootstrapError(
  message: string,
  error?: unknown,
  meta?: Record<string, unknown>
): void {
  bootstrapLogger.error(message, {
    ...(meta ?? {}),
    error:
      error instanceof Error
        ? {
            message: error.message,
            stack: error.stack,
            name: error.name,
          }
        : error,
  });
}
