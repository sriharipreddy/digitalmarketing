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
import { TokenCrypto } from './_helpers/encryption.js';
import { OAuthDriverRegistry, StubOAuthDriver } from './_services/oauth.driver.js';
import { AccountService } from './_services/account.service.js';
import { PostService } from './_services/post.service.js';
import { AccountController } from './controllers/account.controller.js';
import { PostController } from './controllers/post.controller.js';
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

  const tokenCrypto = new TokenCrypto(env.MASTER_DEK_HEX);

  // OAuth driver registry — stub everywhere until OAuth apps are approved.
  const oauthRegistry = new OAuthDriverRegistry();
  oauthRegistry.register(new StubOAuthDriver('facebook'));
  oauthRegistry.register(new StubOAuthDriver('instagram'));
  oauthRegistry.register(new StubOAuthDriver('twitter'));
  oauthRegistry.register(new StubOAuthDriver('linkedin'));
  oauthRegistry.register(new StubOAuthDriver('tiktok'));
  oauthRegistry.register(new StubOAuthDriver('youtube'));
  logger.info({ platforms: oauthRegistry.registered(), driver: env.SOCIAL_DRIVER }, 'oauth_registry_ready');

  const accountService = new AccountService(models, tokenCrypto, oauthRegistry);
  const postService = new PostService(models, accountService, oauthRegistry);

  const accountController = new AccountController(accountService);
  const postController = new PostController(postService);

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

  app.use('/api/v1/social', createApiRouter({ accountController, postController }));

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
