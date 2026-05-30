import { commonEnv, cleanEnv, str, num } from '@marketing/shared-config';

const serviceEnv = cleanEnv(process.env, {
  CORS_ORIGINS: str({ default: 'http://localhost:3000,http://localhost:5173' }),

  // Internal service-to-service publish endpoint expects a shared signing secret.
  // Any service that calls POST /internal/publish needs this.
  INTERNAL_PUBLISH_SECRET: str({ default: '' }),

  // SSE keep-alive ping interval in seconds (sends a comment line to keep proxies happy).
  SSE_PING_SECONDS: num({ default: 25 }),

  SERVICE_NAME_SELF: str({ default: 'notification-service' }),
});

export const env = {
  ...commonEnv,
  ...serviceEnv,
  CORS_ORIGINS_LIST: serviceEnv.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
};
