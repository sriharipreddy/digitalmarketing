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
import { RealOpenAIImageDriver, StubImageDriver, type ImageDriver } from './_services/image.driver.js';
import { RealWhisperDriver, StubTranscriptDriver, type TranscriptDriver } from './_services/transcript.driver.js';
import { RealYouTubeDriver, StubYouTubeDriver, type YouTubeDriver } from './_services/youtube.driver.js';
import { ImageService } from './_services/image.service.js';
import { VideoService } from './_services/video.service.js';
import { ImageController } from './controllers/image.controller.js';
import { VideoController } from './controllers/video.controller.js';
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

  const imageDriver: ImageDriver =
    env.AI_DRIVER === 'openai' && env.OPENAI_API_KEY
      ? new RealOpenAIImageDriver(env.OPENAI_API_KEY)
      : new StubImageDriver();

  const transcriptDriver: TranscriptDriver =
    env.AI_DRIVER === 'openai' && env.OPENAI_API_KEY
      ? new RealWhisperDriver(env.OPENAI_API_KEY)
      : new StubTranscriptDriver();

  const youtubeDriver: YouTubeDriver =
    env.YOUTUBE_API_KEY ? new RealYouTubeDriver(env.YOUTUBE_API_KEY) : new StubYouTubeDriver();

  logger.info(
    {
      image_driver: imageDriver.constructor.name,
      transcript_driver: transcriptDriver.constructor.name,
      youtube_driver: youtubeDriver.constructor.name,
      image_model: env.IMAGE_MODEL_DEFAULT,
      whisper_model: env.WHISPER_MODEL_DEFAULT,
    },
    'drivers_ready',
  );

  const imageService = new ImageService(models, imageDriver, env.IMAGE_MODEL_DEFAULT);
  const videoService = new VideoService(models, youtubeDriver, transcriptDriver, env.WHISPER_MODEL_DEFAULT);

  const imageController = new ImageController(imageService);
  const videoController = new VideoController(videoService);

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

  app.use('/api/v1/media', createApiRouter({ imageController, videoController }));

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
