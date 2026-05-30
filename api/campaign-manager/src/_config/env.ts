import { commonEnv, cleanEnv, str } from '@marketing/shared-config';

const serviceEnv = cleanEnv(process.env, {
  CORS_ORIGINS: str({ default: 'http://localhost:3000,http://localhost:5173' }),
  // Peer services
  EMAIL_HUB_URL: str({ default: 'http://localhost:3106' }),
  CONTENT_AI_URL: str({ default: 'http://localhost:3102' }),
  SEO_ENGINE_URL: str({ default: 'http://localhost:3101' }),
  CRM_AUTOMATION_URL: str({ default: 'http://localhost:3110' }),
  INTELLIGENCE_URL: str({ default: 'http://localhost:3107' }),

  SERVICE_NAME_SELF: str({ default: 'campaign-manager' }),
});

export const env = {
  ...commonEnv,
  ...serviceEnv,
  CORS_ORIGINS_LIST: serviceEnv.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
};
