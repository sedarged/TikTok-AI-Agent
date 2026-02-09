import winston from 'winston';
import { env } from '../env.js';

const logLevel = env.LOG_LEVEL;
const isDevelopment = env.NODE_ENV === 'development';
const isTest = env.NODE_ENV === 'test';

// Create logger instance
export const logger = winston.createLogger({
  level: isTest ? 'error' : logLevel, // Only errors in test to reduce noise
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: isDevelopment
        ? winston.format.combine(winston.format.colorize(), winston.format.simple())
        : winston.format.json(),
      silent: isTest && logLevel !== 'debug', // Silence console in tests unless debug
    }),
  ],
});

// Helper for logging in consistent format
export function logInfo(message: string, meta?: Record<string, unknown>): void {
  logger.info(message, meta);
}

export function logError(message: string, error?: unknown, meta?: Record<string, unknown>): void {
  logger.error(message, {
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

export function logWarn(message: string, meta?: Record<string, unknown>): void {
  logger.warn(message, meta);
}

export function logDebug(message: string, meta?: Record<string, unknown>): void {
  logger.debug(message, meta);
}

// Interface for operation logging
export interface OperationLogContext {
  requestId?: string;
  operation: string;
  planVersionId?: string;
  projectId?: string;
  duration?: number;
  openai?: {
    model?: string;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    latencyMs?: number;
  };
  error?: unknown;
  [key: string]: unknown;
}

/**
 * Log the start of an operation
 * Returns a timer function that can be called to log completion with duration
 */
export function logOperationStart(context: OperationLogContext): () => void {
  const startTime = Date.now();
  logInfo(`Operation started: ${context.operation}`, {
    ...context,
    timestamp: new Date().toISOString(),
  });

  // Return a function to log completion
  return () => {
    const duration = Date.now() - startTime;
    logInfo(`Operation completed: ${context.operation}`, {
      ...context,
      duration,
      timestamp: new Date().toISOString(),
    });
  };
}

/**
 * Log an operation failure with duration
 */
export function logOperationError(
  context: OperationLogContext,
  error: unknown,
  startTime?: number
): void {
  const errorContext = {
    ...context,
    duration: startTime ? Date.now() - startTime : undefined,
    timestamp: new Date().toISOString(),
  };

  logError(`Operation failed: ${context.operation}`, error, errorContext);
}
