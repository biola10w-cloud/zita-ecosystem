import * as Sentry from '@sentry/node';
import { config } from '../../config';

let initialized = false;

export function initSentry(): void {
  if (!config.SENTRY_DSN) return; // No-op if not configured
  if (initialized) return;

  Sentry.init({
    dsn: config.SENTRY_DSN,
    environment: config.NODE_ENV,
    tracesSampleRate: config.NODE_ENV === 'production' ? 0.1 : 1.0,
  });

  initialized = true;
}

export function captureException(error: unknown): void {
  if (!initialized) return;
  Sentry.captureException(error);
}

export function isSentryEnabled(): boolean {
  return initialized;
}
