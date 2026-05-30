import { commonEnv, cleanEnv, str, num } from '@marketing/shared-config';

const serviceEnv = cleanEnv(process.env, {
  CORS_ORIGINS: str({ default: 'http://localhost:3000,http://localhost:5173' }),

  // OpenAI
  AI_DRIVER: str({ choices: ['openai', 'stub'], default: 'stub' }),
  OPENAI_API_KEY: str({ default: '' }),
  OPENAI_MODEL_DEFAULT: str({ default: 'gpt-4o-mini' }),

  // Per-workspace daily token caps. Override per plan in the DB later;
  // these are the fallback when no plan-specific limit exists.
  AI_CAP_FREE_TOKENS_PER_DAY: num({ default: 10_000 }),
  AI_CAP_STARTER_TOKENS_PER_DAY: num({ default: 100_000 }),
  AI_CAP_PRO_TOKENS_PER_DAY: num({ default: 1_000_000 }),
  AI_CAP_AGENCY_TOKENS_PER_DAY: num({ default: 10_000_000 }),
});

export const env = {
  ...commonEnv,
  ...serviceEnv,
  CORS_ORIGINS_LIST: serviceEnv.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
};
