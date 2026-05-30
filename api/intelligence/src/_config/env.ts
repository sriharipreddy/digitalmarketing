import { commonEnv, cleanEnv, str } from '@marketing/shared-config';

const serviceEnv = cleanEnv(process.env, {
  CORS_ORIGINS: str({ default: 'http://localhost:3000,http://localhost:5173' }),

  INTELLIGENCE_DRIVER: str({ choices: ['live', 'stub'], default: 'stub' }),

  // Meta Ad Library (open / no API key)
  // Google Ads Transparency Center (scraped — no key)
  // SimilarWeb (paid, optional)
  SIMILARWEB_API_KEY: str({ default: '' }),

  SERVICE_NAME_SELF: str({ default: 'intelligence' }),
});

export const env = {
  ...commonEnv,
  ...serviceEnv,
  CORS_ORIGINS_LIST: serviceEnv.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
};
