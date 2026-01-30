import winston from 'winston';
import { env } from '../env.js';

const logLevel = process.env.LOG_LEVEL || 'info';
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
