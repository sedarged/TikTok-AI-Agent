import * as Sentry from '@sentry/react';

/**
 * Initialize Sentry for React app
 * Should be called before app render
 */
export function initSentry(): void {
  const sentryDsn = import.meta.env.VITE_SENTRY_DSN;

  if (!sentryDsn) {
    console.info('Sentry not configured - skipping initialization');
    return;
  }

  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,

    // Performance monitoring
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 0.0,

    // Capture Replay for session replay on errors
    replaysSessionSampleRate: 0.0,
    replaysOnErrorSampleRate: import.meta.env.PROD ? 0.5 : 0.0,

    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],

    // Filter out sensitive data
    beforeSend(event) {
      // Remove auth tokens from requests
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
      }

      return event;
    },
  });
}
