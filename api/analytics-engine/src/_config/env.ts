import { commonEnv, cleanEnv, str, num } from '@marketing/shared-config';

const serviceEnv = cleanEnv(process.env, {
  CORS_ORIGINS: str({ default: 'http://localhost:3000,http://localhost:5173,*' }),

  // Cap the size of a single /track payload (defends against runaway events).
  TRACK_MAX_BODY_KB: num({ default: 32 }),

  SERVICE_NAME_SELF: str({ default: 'analytics-engine' }),
});

export const env = {
  ...commonEnv,
  ...serviceEnv,
  CORS_ORIGINS_LIST: serviceEnv.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
};
