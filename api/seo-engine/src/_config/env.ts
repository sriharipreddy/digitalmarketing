import { commonEnv, cleanEnv, str } from '@marketing/shared-config';

const serviceEnv = cleanEnv(process.env, {
  CORS_ORIGINS: str({ default: 'http://localhost:3000,http://localhost:5173' }),

  // DataForSEO (optional — falls back to stub for keyword research).
  DATAFORSEO_DRIVER: str({ choices: ['dataforseo', 'stub'], default: 'stub' }),
  DATAFORSEO_USERNAME: str({ default: '' }),
  DATAFORSEO_PASSWORD: str({ default: '' }),
});

export const env = {
  ...commonEnv,
  ...serviceEnv,
  CORS_ORIGINS_LIST: serviceEnv.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
};
