import { commonEnv, cleanEnv, str, num } from '@marketing/shared-config';

const serviceEnv = cleanEnv(process.env, {
  CORS_ORIGINS: str({ default: 'http://localhost:3000,http://localhost:5173' }),

  // Public-facing redirect base (e.g. https://go.yourdomain.com). Tracking links
  // resolve as ${AFFILIATE_REDIRECT_BASE}/a/:code. Defaults to same-host /api/v1/affiliate.
  AFFILIATE_REDIRECT_BASE: str({ default: '' }),

  // Cookie attribution window in days for click → conversion.
  ATTRIBUTION_COOKIE_DAYS: num({ default: 30 }),

  // Stripe Connect (for affiliate payouts; optional in v1).
  STRIPE_DRIVER: str({ choices: ['stripe', 'stub'], default: 'stub' }),
  STRIPE_SECRET_KEY: str({ default: '' }),

  SERVICE_NAME_SELF: str({ default: 'affiliate-hub' }),

  // Notifications fan-out (optional — silently no-ops if URL or secret is unset)
  NOTIFICATION_SERVICE_URL: str({ default: 'http://localhost:3112' }),
  NOTIFICATION_PUBLISH_SECRET: str({ default: '' }),

  // Customer-facing event bus (integration-service) — same HMAC secret
  INTEGRATION_SERVICE_URL: str({ default: 'http://localhost:3113' }),
  INTEGRATION_PUBLISH_SECRET: str({ default: '' }),
});

export const env = {
  ...commonEnv,
  ...serviceEnv,
  CORS_ORIGINS_LIST: serviceEnv.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
};
