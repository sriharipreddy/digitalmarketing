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
import { CampaignService } from './_services/campaign.service.js';
import { UtmService } from './_services/utm.service.js';
import { EmailHubClient } from './_services/email-hub.client.js';
import { ContentAiClient } from './_services/content-ai.client.js';
import { SeoEngineClient } from './_services/seo-engine.client.js';
import { CrmAutomationClient } from './_services/crm-automation.client.js';
import { IntelligenceClient } from './_services/intelligence.client.js';
import { OneClickService } from './_services/one-click.service.js';
import { CampaignController } from './controllers/campaign.controller.js';
import { UtmController } from './controllers/utm.controller.js';
import { OneClickController } from './controllers/one-click.controller.js';
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

  const emailHubClient = new EmailHubClient(env.EMAIL_HUB_URL, env.JWT_SECRET, env.SERVICE_NAME_SELF);
  const contentAiClient = new ContentAiClient(env.CONTENT_AI_URL);
  const seoEngineClient = new SeoEngineClient(env.SEO_ENGINE_URL);
  const crmAutomationClient = new CrmAutomationClient(env.CRM_AUTOMATION_URL);
  const intelligenceClient = new IntelligenceClient(env.INTELLIGENCE_URL);
  logger.info(
    {
      email_hub: env.EMAIL_HUB_URL,
      content_ai: env.CONTENT_AI_URL,
      seo_engine: env.SEO_ENGINE_URL,
      crm_automation: env.CRM_AUTOMATION_URL,
      intelligence: env.INTELLIGENCE_URL,
    },
    'peer_clients_ready',
  );

  const utmService = new UtmService(models);
  const campaignService = new CampaignService(sequelize, models, emailHubClient);
  const oneClickService = new OneClickService(
    sequelize,
    models,
    contentAiClient,
    seoEngineClient,
    crmAutomationClient,
    intelligenceClient,
    utmService,
    logger,
  );

  const utmController = new UtmController(utmService);
  const campaignController = new CampaignController(campaignService);
  const oneClickController = new OneClickController(oneClickService);

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

  app.use('/api/v1/campaign', createApiRouter({ campaignController, utmController, oneClickController }));

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
