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
import { ProgramService } from './_services/program.service.js';
import { AffiliateService } from './_services/affiliate.service.js';
import { TrackingLinkService } from './_services/tracking-link.service.js';
import { CommissionService } from './_services/commission.service.js';
import { NotificationClient } from './_services/notification.client.js';
import { EventBusClient } from './_services/event-bus.client.js';
import { ProgramController } from './controllers/program.controller.js';
import { AffiliateController } from './controllers/affiliate.controller.js';
import { TrackingLinkController } from './controllers/tracking-link.controller.js';
import { CommissionController } from './controllers/commission.controller.js';
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

  const notificationClient = new NotificationClient(
    env.NOTIFICATION_SERVICE_URL,
    env.NOTIFICATION_PUBLISH_SECRET,
    env.SERVICE_NAME_SELF,
    logger,
  );
  if (!env.NOTIFICATION_PUBLISH_SECRET) {
    logger.info('notifications_disabled', 'NOTIFICATION_PUBLISH_SECRET unset — notification publishes are no-ops');
  }

  const eventBusClient = new EventBusClient(
    env.INTEGRATION_SERVICE_URL,
    env.INTEGRATION_PUBLISH_SECRET,
    logger,
  );
  if (!env.INTEGRATION_PUBLISH_SECRET) {
    logger.info('event_bus_disabled', 'INTEGRATION_PUBLISH_SECRET unset — outbound webhook events disabled');
  }

  const programService = new ProgramService(models);
  const affiliateService = new AffiliateService(models);
  const trackingLinkService = new TrackingLinkService(models);
  const commissionService = new CommissionService(models, notificationClient, eventBusClient);

  const programController = new ProgramController(programService);
  const affiliateController = new AffiliateController(affiliateService);
  const trackingLinkController = new TrackingLinkController(trackingLinkService, env.ATTRIBUTION_COOKIE_DAYS);
  const commissionController = new CommissionController(commissionService);

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
    '/api/v1/affiliate',
    createApiRouter({ programController, affiliateController, trackingLinkController, commissionController }),
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
