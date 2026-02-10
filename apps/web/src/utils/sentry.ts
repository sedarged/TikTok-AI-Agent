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
        // Mask text and block media in production to avoid capturing PII
        maskAllText: import.meta.env.PROD ? true : false,
        blockAllMedia: import.meta.env.PROD ? true : false,
      }),
    ],

    // Filter out sensitive data
    beforeSend(event) {
      // Remove auth tokens from requests (case-insensitive)
      if (event.request?.headers) {
        const headers = event.request.headers as Record<string, unknown>;
        for (const headerName of Object.keys(headers)) {
          const lowerName = headerName.toLowerCase();
          if (lowerName === 'authorization' || lowerName === 'x-api-key') {
            delete headers[headerName];
          }
        }
      }

      return event;
    },
  });
}
