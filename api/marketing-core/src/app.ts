import * as Sentry from '@sentry/node';
import { env } from './_config/env.js';

// Sentry must be initialised before any other imports that might emit errors.
if (env.SENTRY_ENABLED && env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: parseFloat(env.SENTRY_TRACES_SAMPLE_RATE) || 0,
    serverName: env.SERVICE_NAME,
  });
}

import express from 'express';
import {
  applyBaseMiddleware,
  configurePassport,
  createLogger,
  errorHandler,
  healthRoutes,
  NotFoundError,
} from '@marketing/shared-middleware';
import { createSequelize, syncDatabase } from '@marketing/shared-db';
import { initModels } from './models/index.js';
import { seedInitialData } from './seeds/index.js';
import { AuthService } from './_services/auth.service.js';
import { WorkspaceService } from './_services/workspace.service.js';
import { MemberService } from './_services/member.service.js';
import { AuditService } from './_services/audit.service.js';
import { EmailVerifyService } from './_services/email-verify.service.js';
import { TotpService } from './_services/totp.service.js';
import { BillingService } from './_services/billing.service.js';
import { SendGridDriver, StubEmailDriver, type EmailDriver } from './_services/email.driver.js';
import { RealStripeDriver, StubStripeDriver, type StripeDriver } from './_services/stripe.driver.js';
import { AuthController } from './controllers/auth.controller.js';
import { WorkspaceController } from './controllers/workspace.controller.js';
import { MemberController } from './controllers/member.controller.js';
import { AuditController } from './controllers/audit.controller.js';
import { EmailVerifyController } from './controllers/email-verify.controller.js';
import { TotpController } from './controllers/totp.controller.js';
import { BillingController } from './controllers/billing.controller.js';
import { createApiRouter, createWebhookRouter } from './routes/index.js';

const PKG_VERSION = '0.1.0';

async function bootstrap(): Promise<void> {
  const logger = createLogger(env.SERVICE_NAME, env.LOG_LEVEL);
  logger.info({ env: env.NODE_ENV, port: env.PORT }, 'starting');

  // 1. Database
  const sequelize = createSequelize({
    databaseUrl: env.DATABASE_URL,
    readUrl: env.DATABASE_READ_URL || undefined,
    dialect: env.DB_DIALECT,
    poolMax: env.DB_POOL_MAX,
    poolMin: env.DB_POOL_MIN,
    serviceName: env.SERVICE_NAME,
    logLevel: env.LOG_LEVEL,
  });

  try {
    await sequelize.authenticate();
    logger.info('database_connected');
  } catch (err) {
    logger.fatal({ err }, 'database_connection_failed');
    process.exit(1);
  }

  // 2. Models + sync
  const models = initModels(sequelize);
  logger.info({ models: Object.keys(models) }, 'models_registered');

  await syncDatabase(sequelize);
  logger.info('database_synced');

  // 3. Seed initial data (idempotent)
  await seedInitialData(sequelize, models);
  logger.info('seeds_complete');

  // 4. Build the service layer
  // 4a. External drivers
  const emailDriver: EmailDriver =
    env.EMAIL_DRIVER === 'sendgrid' && env.SENDGRID_API_KEY
      ? new SendGridDriver(env.SENDGRID_API_KEY, { email: env.EMAIL_FROM, name: env.EMAIL_FROM_NAME })
      : new StubEmailDriver(logger);
  logger.info({ driver: emailDriver.constructor.name }, 'email_driver_ready');

  const stripeDriver: StripeDriver =
    env.STRIPE_DRIVER === 'stripe' && env.STRIPE_SECRET_KEY
      ? new RealStripeDriver(env.STRIPE_SECRET_KEY, env.STRIPE_WEBHOOK_SECRET)
      : new StubStripeDriver(logger);
  logger.info({ driver: stripeDriver.constructor.name }, 'stripe_driver_ready');

  const requireEmailVerification = env.EMAIL_DRIVER === 'sendgrid' && Boolean(env.SENDGRID_API_KEY);

  // 4b. Domain services
  const authService = new AuthService({
    sequelize,
    models,
    jwtSecret: env.JWT_SECRET,
    accessTokenLifetime: env.JWT_ACCESS_TOKEN_LIFETIME,
    refreshTokenTtlDays: 30,
    bcryptRounds: 10,
    requireEmailVerification,
  });

  const workspaceService = new WorkspaceService(models);
  const memberService = new MemberService(sequelize, models);
  const auditService = new AuditService(models);
  const emailVerifyService = new EmailVerifyService({
    models,
    emailDriver,
    appBaseUrl: env.APP_BASE_URL,
    logger,
  });
  const totpService = new TotpService({ models, encryptionKeyHex: env.MASTER_DEK_HEX });
  const billingService = new BillingService({
    models,
    stripeDriver,
    appBaseUrl: env.APP_BASE_URL,
    priceMap: {
      starter: env.STRIPE_PRICE_STARTER || undefined,
      pro: env.STRIPE_PRICE_PRO || undefined,
      agency: env.STRIPE_PRICE_AGENCY || undefined,
    },
    logger,
  });

  // 4c. Controllers
  const authController = new AuthController(
    authService,
    emailVerifyService,
    /* cookieDomain */ '',
    /* refreshCookieMaxAge */ 30 * 24 * 60 * 60 * 1000,
    env.NODE_ENV === 'production',
    requireEmailVerification,
  );
  const workspaceController = new WorkspaceController(workspaceService, auditService);
  const memberController = new MemberController(memberService, auditService);
  const auditController = new AuditController(auditService, workspaceService);
  const emailVerifyController = new EmailVerifyController(emailVerifyService, auditService, models);
  const totpController = new TotpController(
    totpService,
    authService,
    auditService,
    /* cookieDomain */ '',
    /* refreshCookieMaxAge */ 30 * 24 * 60 * 60 * 1000,
    env.NODE_ENV === 'production',
  );
  const billingController = new BillingController(
    billingService,
    stripeDriver,
    auditService,
    env.STRIPE_DRIVER !== 'stripe' || !env.STRIPE_SECRET_KEY,
  );

  // 5. Express app
  const app = express();
  let isReady = false;

  // Configure passport BEFORE applyBaseMiddleware (passport is initialised inside)
  configurePassport(env.JWT_SECRET);

  // 5a. Stripe webhook BEFORE JSON body parser — needs raw body for signature verification
  app.use('/api/v1/core', createWebhookRouter(billingController));

  applyBaseMiddleware(app, { logger, corsOrigins: env.CORS_ORIGINS_LIST });

  // Health endpoints
  app.use(
    healthRoutes({
      serviceName: env.SERVICE_NAME,
      version: PKG_VERSION,
      ready: () => isReady,
      checks: [
        {
          name: 'database',
          critical: true,
          check: async () => {
            await sequelize.query('SELECT 1');
            return { status: 'healthy' };
          },
        },
      ],
    }),
  );

  // API routes
  app.use(
    '/api/v1/core',
    createApiRouter({
      authController,
      workspaceController,
      memberController,
      auditController,
      emailVerifyController,
      totpController,
      billingController,
    }),
  );

  // 404 fallback
  app.use((req, _res, next) => next(new NotFoundError(`Route not found: ${req.method} ${req.path}`)));

  // Error handler — must be last
  app.use(errorHandler(logger));

  // 6. Start server
  const server = app.listen(env.PORT, () => {
    isReady = true;
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'service_ready');
  });

  // 7. Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'shutdown_initiated');
    isReady = false;
    server.close();
    await new Promise((resolve) => setTimeout(resolve, 5_000));
    await sequelize.close();
    logger.info('shutdown_complete');
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
