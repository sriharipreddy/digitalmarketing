import { commonEnv, cleanEnv, str } from '@marketing/shared-config';

const serviceEnv = cleanEnv(process.env, {
  CORS_ORIGINS: str({ default: 'http://localhost:3000,http://localhost:5173' }),

  SOCIAL_DRIVER: str({ choices: ['live', 'stub'], default: 'stub' }),

  // Meta (Facebook + Instagram)
  META_APP_ID: str({ default: '' }),
  META_APP_SECRET: str({ default: '' }),
  META_REDIRECT_URI: str({ default: 'http://localhost:3000/dashboard/social/callback/meta' }),

  // Twitter / X
  TWITTER_CLIENT_ID: str({ default: '' }),
  TWITTER_CLIENT_SECRET: str({ default: '' }),
  TWITTER_REDIRECT_URI: str({ default: 'http://localhost:3000/dashboard/social/callback/twitter' }),

  // LinkedIn
  LINKEDIN_CLIENT_ID: str({ default: '' }),
  LINKEDIN_CLIENT_SECRET: str({ default: '' }),
  LINKEDIN_REDIRECT_URI: str({ default: 'http://localhost:3000/dashboard/social/callback/linkedin' }),

  SERVICE_NAME_SELF: str({ default: 'social-hub' }),
});

export const env = {
  ...commonEnv,
  ...serviceEnv,
  CORS_ORIGINS_LIST: serviceEnv.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
};
