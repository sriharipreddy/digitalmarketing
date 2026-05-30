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
import { env } from './_config/env.js';
import { initModels } from './models/index.js';
import { SendGridDriver, StubEmailDriver, type EmailDriver } from './_services/email.driver.js';
import { AudienceService } from './_services/audience.service.js';
import { ListService } from './_services/list.service.js';
import { SendService } from './_services/send.service.js';
import { EmailWebhookService } from './_services/webhook.service.js';
import {
  TwilioSmsDriver,
  WhatsApp360Driver,
  FcmPushDriver,
  StubMessagingDriver,
  type MessagingDriver,
} from './_services/messaging.drivers.js';
import { MessagingService } from './_services/messaging.service.js';
import { ListController } from './controllers/list.controller.js';
import { SendController } from './controllers/send.controller.js';
import { EmailWebhookController } from './controllers/webhook.controller.js';
import { MessagingController } from './controllers/messaging.controller.js';
import { createApiRouter, createWebhookRouter } from './routes/index.js';

const PKG_VERSION = '0.1.0';

async function bootstrap(): Promise<void> {
  const logger = createLogger(env.SERVICE_NAME, env.LOG_LEVEL);
  logger.info({ env: env.NODE_ENV, port: env.PORT }, 'starting');

  const sequelize = createSequelize({
    databaseUrl: env.DATABASE_URL,
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

  const models = initModels(sequelize);
  logger.info({ models: Object.keys(models) }, 'models_registered');

  await syncDatabase(sequelize);
  logger.info('database_synced');

  const driver: EmailDriver =
    env.EMAIL_DRIVER === 'sendgrid' && env.SENDGRID_API_KEY
      ? new SendGridDriver(env.SENDGRID_API_KEY, env.EMAIL_BATCH_SIZE)
      : new StubEmailDriver(logger);
  logger.info({ driver: driver.constructor.name, sandbox: env.SENDGRID_SANDBOX }, 'email_driver_ready');

  const audienceService = new AudienceService(sequelize);
  const listService = new ListService(models, audienceService);
  const sendService = new SendService(
    models,
    driver,
    audienceService,
    listService,
    env.EMAIL_FROM,
    env.EMAIL_FROM_NAME,
    env.SENDGRID_SANDBOX,
    logger,
  );
  const webhookService = new EmailWebhookService(
    models,
    audienceService,
    env.SENDGRID_WEBHOOK_VERIFICATION_KEY,
    logger,
  );

  const smsDriver: MessagingDriver =
    env.SMS_DRIVER === 'twilio' && env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN
      ? new TwilioSmsDriver(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN, env.TWILIO_FROM_NUMBER)
      : new StubMessagingDriver('sms', logger);
  const whatsappDriver: MessagingDriver =
    env.WHATSAPP_DRIVER === 'd360' && env.WHATSAPP_API_KEY
      ? new WhatsApp360Driver(env.WHATSAPP_API_KEY, env.WHATSAPP_BASE_URL, env.WHATSAPP_FROM_NUMBER)
      : new StubMessagingDriver('whatsapp', logger);
  const pushDriver: MessagingDriver =
    env.PUSH_DRIVER === 'fcm' && env.FCM_SERVER_KEY
      ? new FcmPushDriver(env.FCM_SERVER_KEY, env.FCM_ENDPOINT)
      : new StubMessagingDriver('push', logger);
  logger.info(
    { sms: smsDriver.constructor.name, whatsapp: whatsappDriver.constructor.name, push: pushDriver.constructor.name },
    'messaging_drivers_ready',
  );

  const messagingService = new MessagingService(
    models,
    { sms: smsDriver, whatsapp: whatsappDriver, push: pushDriver },
    { start_hour: env.QUIET_HOURS_START, end_hour: env.QUIET_HOURS_END, channels: ['sms', 'whatsapp'] },
    logger,
  );

  const listController = new ListController(listService);
  const sendController = new SendController(sendService);
  const webhookController = new EmailWebhookController(webhookService);
  const messagingController = new MessagingController(messagingService);

  const app = express();
  let isReady = false;

  configurePassport(env.JWT_SECRET);

  // Webhook router BEFORE JSON body parser (raw body needed)
  app.use('/api/v1/email', createWebhookRouter(webhookController));

  applyBaseMiddleware(app, { logger, corsOrigins: env.CORS_ORIGINS_LIST });

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

  app.use(
    '/api/v1/email',
    createApiRouter({
      listController,
      sendController,
      messagingController,
      jwtSecret: env.JWT_SECRET,
      serviceSelfName: env.SERVICE_NAME_SELF,
    }),
  );

  app.use((req, _res, next) => next(new NotFoundError(`Route not found: ${req.method} ${req.path}`)));
  app.use(errorHandler(logger));

  const server = app.listen(env.PORT, () => {
    isReady = true;
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'service_ready');
  });

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
