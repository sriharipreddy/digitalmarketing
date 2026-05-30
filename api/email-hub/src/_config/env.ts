import { commonEnv, cleanEnv, str, bool, num } from '@marketing/shared-config';

const serviceEnv = cleanEnv(process.env, {
  CORS_ORIGINS: str({ default: 'http://localhost:3000,http://localhost:5173' }),

  // SendGrid
  EMAIL_DRIVER: str({ choices: ['sendgrid', 'stub'], default: 'stub' }),
  SENDGRID_API_KEY: str({ default: '' }),
  SENDGRID_SANDBOX: bool({ default: false }),
  SENDGRID_WEBHOOK_VERIFICATION_KEY: str({ default: '' }),
  EMAIL_FROM: str({ default: 'noreply@yourplatform.local' }),
  EMAIL_FROM_NAME: str({ default: 'Marketing Platform' }),

  // Concurrency control for bulk sends
  EMAIL_BATCH_SIZE: num({ default: 250 }),

  SERVICE_NAME_SELF: str({ default: 'email-hub' }),

  // ─── Messaging providers (Phase 5) ─────────────────────────────────
  SMS_DRIVER: str({ choices: ['twilio', 'stub'], default: 'stub' }),
  TWILIO_ACCOUNT_SID: str({ default: '' }),
  TWILIO_AUTH_TOKEN: str({ default: '' }),
  TWILIO_FROM_NUMBER: str({ default: '' }),

  WHATSAPP_DRIVER: str({ choices: ['d360', 'stub'], default: 'stub' }),
  WHATSAPP_API_KEY: str({ default: '' }),
  WHATSAPP_BASE_URL: str({ default: 'https://waba.messagepipe.io/v1' }),
  WHATSAPP_FROM_NUMBER: str({ default: '' }),

  PUSH_DRIVER: str({ choices: ['fcm', 'stub'], default: 'stub' }),
  FCM_SERVER_KEY: str({ default: '' }),
  FCM_ENDPOINT: str({ default: 'https://fcm.googleapis.com/fcm/send' }),

  // TCPA quiet hours (recipient-local time)
  QUIET_HOURS_START: num({ default: 9 }),  // 9 am
  QUIET_HOURS_END: num({ default: 21 }),   // 9 pm
});

export const env = {
  ...commonEnv,
  ...serviceEnv,
  CORS_ORIGINS_LIST: serviceEnv.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
};
