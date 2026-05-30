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
import { ApiKeyService } from './_services/api-key.service.js';
import { WebhookService } from './_services/webhook.service.js';
import { EventReceiverService } from './_services/event-receiver.service.js';
import { DeliveryWorker } from './_services/delivery-worker.js';
import { ImportService } from './_services/import.service.js';
import { CrmDirectSink } from './_services/crm-direct.sink.js';
import { ExportService } from './_services/export.service.js';
import { ApiKeyController } from './controllers/api-key.controller.js';
import { WebhookController } from './controllers/webhook.controller.js';
import { PublicV2Controller } from './controllers/public-v2.controller.js';
import { EventController } from './controllers/event.controller.js';
import { ImportController } from './controllers/import.controller.js';
import { ExportController } from './controllers/export.controller.js';
import { createApiRouter } from './routes/index.js';

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

  if (!env.INTERNAL_PUBLISH_SECRET) {
    logger.warn(
      'INTERNAL_PUBLISH_SECRET is empty — /internal/events will reject all publishes',
    );
  }

  const apiKeyService = new ApiKeyService(models);
  const webhookService = new WebhookService(models);
  const eventReceiverService = new EventReceiverService(models, webhookService);
  const deliveryWorker = new DeliveryWorker({
    models,
    maxAttempts: env.WEBHOOK_MAX_ATTEMPTS,
    initialDelayMs: env.WEBHOOK_INITIAL_DELAY_MS,
    backoffFactor: env.WEBHOOK_BACKOFF_FACTOR,
    pollIntervalMs: 5_000,
    concurrency: 5,
    logger,
  });

  const crmSink = new CrmDirectSink(sequelize);
  const importService = new ImportService(models, crmSink, logger);
  const exportService = new ExportService(sequelize, models, logger);

  const apiKeyController = new ApiKeyController(apiKeyService);
  const webhookController = new WebhookController(webhookService);
  const publicV2Controller = new PublicV2Controller();
  const eventController = new EventController(eventReceiverService);
  const importController = new ImportController(importService);
  const exportController = new ExportController(exportService);

  const app = express();
  let isReady = false;

  configurePassport(env.JWT_SECRET);
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
    '/api/v1/integration',
    createApiRouter({
      models,
      apiKeyController,
      webhookController,
      publicV2Controller,
      eventController,
      importController,
      exportController,
      internalPublishSecret: env.INTERNAL_PUBLISH_SECRET,
      ratePerMinute: env.RATE_LIMIT_PER_MINUTE,
    }),
  );

  app.use((req, _res, next) => next(new NotFoundError(`Route not found: ${req.method} ${req.path}`)));
  app.use(errorHandler(logger));

  const server = app.listen(env.PORT, () => {
    isReady = true;
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'service_ready');
    deliveryWorker.start();
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'shutdown_initiated');
    isReady = false;
    deliveryWorker.stop();
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
