import * as Sentry from '@sentry/node';
import { env } from '../env.js';
import { logInfo, logWarn } from './logger.js';

let sentryInitialized = false;

/**
 * Initialize Sentry for error tracking and APM
 * Safe to call multiple times - only initializes once
 */
export function initSentry(): void {
  if (sentryInitialized) {
    return;
  }

  // Only initialize if DSN is configured
  if (!env.SENTRY_DSN) {
    logInfo(
      'Sentry not configured - skipping initialization. Set SENTRY_DSN to enable error tracking.'
    );
    return;
  }

  try {
    Sentry.init({
      dsn: env.SENTRY_DSN,
      environment: env.NODE_ENV,

      // Set sample rate for performance monitoring
      // 0.1 = 10% of transactions are sampled
      tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 0.0,

      // Set sample rate for profiling
      profilesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 0.0,

      // Enable breadcrumbs for better context
      integrations: [
        // Automatically instrument HTTP requests
        Sentry.httpIntegration(),
      ],

      // Filter out sensitive data
      beforeSend(event, _hint) {
        // Remove sensitive headers
        if (event.request?.headers) {
          delete event.request.headers['authorization'];
          delete event.request.headers['cookie'];
        }

        // Remove API keys from environment
        if (event.contexts?.runtime?.env) {
          const env = event.contexts.runtime.env as Record<string, unknown>;
          delete env['OPENAI_API_KEY'];
          delete env['DATABASE_URL'];
          delete env['SENTRY_DSN'];
        }

        return event;
      },
    });

    sentryInitialized = true;
    logInfo('Sentry initialized', {
      environment: env.NODE_ENV,
      tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 0.0,
    });
  } catch (error) {
    logWarn('Failed to initialize Sentry', { error });
  }
}

/**
 * Check if Sentry is initialized
 */
export function isSentryEnabled(): boolean {
  return sentryInitialized;
}

/**
 * Manually capture an exception
 */
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!sentryInitialized) {
    return;
  }

  Sentry.withScope((scope) => {
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setContext(key, value as Record<string, unknown>);
      });
    }
    Sentry.captureException(error);
  });
}

/**
 * Set user context for error tracking
 */
export function setUser(user: { id: string; email?: string; username?: string }): void {
  if (!sentryInitialized) {
    return;
  }

  Sentry.setUser(user);
}

/**
 * Clear user context
 */
export function clearUser(): void {
  if (!sentryInitialized) {
    return;
  }

  Sentry.setUser(null);
}

/**
 * Add breadcrumb for debugging context
 */
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, unknown>
): void {
  if (!sentryInitialized) {
    return;
  }

  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: 'info',
  });
}

/**
 * Initialize Sentry error handling for Express app
 * Call this once after creating the app
 */
export function setupSentryExpress(app: { use: (middleware: unknown) => void }): void {
  if (!sentryInitialized) {
    return;
  }

  try {
    Sentry.setupExpressErrorHandler(app);
  } catch (error) {
    logWarn('Failed to setup Sentry Express error handler', { error });
  }
}
