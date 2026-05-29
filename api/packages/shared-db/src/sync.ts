import type { Sequelize } from 'sequelize';
import pino from 'pino';
import { verifyProductionSchema } from './verify-schema.js';

const logger = pino({ name: 'shared-db:sync' });

/**
 * Environment-aware database sync.
 *
 *   development / staging → sync({ alter: true })   ← auto-adjust to model
 *   production            → sync() + verify         ← no schema changes; refuse if drift
 *   test                  → sync({ force: true })   ← drop + recreate every run
 *
 * Use RESET_DB=true in dev to force a clean re-create.
 */
export async function syncDatabase(sequelize: Sequelize): Promise<void> {
  const env = process.env.NODE_ENV ?? 'development';
  const allowForce = process.env.RESET_DB === 'true';

  if (env === 'test') {
    logger.info('test environment — sync({ force: true })');
    await sequelize.sync({ force: true });
    return;
  }

  if (env === 'development' || env === 'staging') {
    if (allowForce) {
      logger.warn('⚠️  RESET_DB=true — dropping all tables');
      await sequelize.sync({ force: true });
    } else {
      logger.info('sync({ alter: true })');
      await sequelize.sync({ alter: true });
    }
    return;
  }

  if (env === 'production') {
    logger.info('production — sync() + verifyProductionSchema()');
    await sequelize.sync(); // CREATE IF NOT EXISTS only
    await verifyProductionSchema(sequelize);
    return;
  }

  throw new Error(`Unknown NODE_ENV: ${env}`);
}
