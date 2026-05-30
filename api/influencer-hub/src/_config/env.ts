import { commonEnv, cleanEnv, str } from '@marketing/shared-config';

const serviceEnv = cleanEnv(process.env, {
  CORS_ORIGINS: str({ default: 'http://localhost:3000,http://localhost:5173' }),

  // Discovery driver — third-party providers (HypeAuditor, Modash) are optional.
  DISCOVERY_DRIVER: str({ choices: ['live', 'stub'], default: 'stub' }),
  HYPEAUDITOR_API_KEY: str({ default: '' }),
  MODASH_API_KEY: str({ default: '' }),

  SERVICE_NAME_SELF: str({ default: 'influencer-hub' }),
});

export const env = {
  ...commonEnv,
  ...serviceEnv,
  CORS_ORIGINS_LIST: serviceEnv.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
};
