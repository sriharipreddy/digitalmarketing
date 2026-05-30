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
import { BrandVoiceService } from './_services/brand-voice.service.js';
import { GenerationService } from './_services/generation.service.js';
import { TokenCapService } from './_services/token-cap.service.js';
import { ContentPieceService } from './_services/content-piece.service.js';
import { RealOpenAIDriver, StubOpenAIDriver, type OpenAIDriver } from './_services/openai.driver.js';
import { BrandVoiceController } from './controllers/brand-voice.controller.js';
import { GenerationController } from './controllers/generation.controller.js';
import { ContentPieceController } from './controllers/content-piece.controller.js';
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

  const openaiDriver: OpenAIDriver =
    env.AI_DRIVER === 'openai' && env.OPENAI_API_KEY
      ? new RealOpenAIDriver(env.OPENAI_API_KEY)
      : new StubOpenAIDriver();
  logger.info({ driver: openaiDriver.constructor.name, model: env.OPENAI_MODEL_DEFAULT }, 'ai_driver_ready');

  const tokenCapService = new TokenCapService(sequelize, {
    free: env.AI_CAP_FREE_TOKENS_PER_DAY,
    starter: env.AI_CAP_STARTER_TOKENS_PER_DAY,
    pro: env.AI_CAP_PRO_TOKENS_PER_DAY,
    agency: env.AI_CAP_AGENCY_TOKENS_PER_DAY,
  });

  const brandVoiceService = new BrandVoiceService(models);
  const generationService = new GenerationService(
    models,
    openaiDriver,
    tokenCapService,
    env.OPENAI_MODEL_DEFAULT,
  );

  const contentPieceService = new ContentPieceService(
    models,
    openaiDriver,
    tokenCapService,
    env.OPENAI_MODEL_DEFAULT,
  );

  const brandVoiceController = new BrandVoiceController(brandVoiceService);
  const generationController = new GenerationController(generationService);
  const contentPieceController = new ContentPieceController(contentPieceService);

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

  app.use('/api/v1/content', createApiRouter({ brandVoiceController, generationController, contentPieceController }));

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
