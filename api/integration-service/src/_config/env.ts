import { commonEnv, cleanEnv, str, num } from '@marketing/shared-config';

const serviceEnv = cleanEnv(process.env, {
  CORS_ORIGINS: str({ default: 'http://localhost:3000,http://localhost:5173,*' }),

  // Internal publish secret — same shared secret used by notification-service / other peers.
  // When publishers (other services) want to fan out events into the integration-service event bus
  // (which then triggers webhook delivery), they POST /internal/events with HMAC-signed payload.
  INTERNAL_PUBLISH_SECRET: str({ default: '' }),

  // Per-API-key request quotas (sliding window in Redis would be better; in-memory works for dev).
  RATE_LIMIT_PER_MINUTE: num({ default: 600 }),

  // Webhook delivery — retries + backoff
  WEBHOOK_MAX_ATTEMPTS: num({ default: 7 }),
  WEBHOOK_INITIAL_DELAY_MS: num({ default: 5_000 }),
  WEBHOOK_BACKOFF_FACTOR: num({ default: 4 }),

  SERVICE_NAME_SELF: str({ default: 'integration-service' }),
});

export const env = {
  ...commonEnv,
  ...serviceEnv,
  CORS_ORIGINS_LIST: serviceEnv.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
};
