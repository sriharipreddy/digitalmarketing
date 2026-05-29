import { commonEnv, cleanEnv, str, bool } from '@marketing/shared-config';

/**
 * marketing-core specific env vars on top of the shared common env.
 */
const serviceEnv = cleanEnv(process.env, {
  CORS_ORIGINS: str({ default: 'http://localhost:3000,http://localhost:5173' }),
  APP_BASE_URL: str({ default: 'http://localhost:3000' }),

  // Email (SendGrid). Driver=stub logs token to console instead of sending.
  EMAIL_DRIVER: str({ choices: ['sendgrid', 'stub'], default: 'stub' }),
  SENDGRID_API_KEY: str({ default: '' }),
  EMAIL_FROM: str({ default: 'noreply@yourplatform.local' }),
  EMAIL_FROM_NAME: str({ default: 'Marketing Platform' }),

  // Stripe. Driver=stub returns mock checkout sessions instead of calling Stripe.
  STRIPE_DRIVER: str({ choices: ['stripe', 'stub'], default: 'stub' }),
  STRIPE_SECRET_KEY: str({ default: '' }),
  STRIPE_PUBLISHABLE_KEY: str({ default: '' }),
  STRIPE_WEBHOOK_SECRET: str({ default: '' }),
  STRIPE_PRICE_STARTER: str({ default: '' }),
  STRIPE_PRICE_PRO: str({ default: '' }),
  STRIPE_PRICE_AGENCY: str({ default: '' }),

  // Sentry
  SENTRY_TRACES_SAMPLE_RATE: str({ default: '0.0' }),
  SENTRY_ENABLED: bool({ default: false }),
});

export const env = {
  ...commonEnv,
  ...serviceEnv,
  CORS_ORIGINS_LIST: serviceEnv.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
};
