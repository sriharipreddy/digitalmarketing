import { Sequelize, Options } from 'sequelize';
import pino from 'pino';

export interface CreateSequelizeOpts {
  databaseUrl: string;
  readUrl?: string;
  dialect: 'mysql' | 'postgres';
  poolMax?: number;
  poolMin?: number;
  serviceName: string;
  logLevel?: string;
}

/**
 * Creates a Sequelize instance configured for either MySQL (dev) or PostgreSQL (prod).
 * The DATABASE_URL controls which one — same code, different connection string.
 */
export function createSequelize(opts: CreateSequelizeOpts): Sequelize {
  const logger = pino({ name: `${opts.serviceName}:db`, level: opts.logLevel ?? 'info' });

  const baseOptions: Options = {
    dialect: opts.dialect,
    logging: (sql, timing) => {
      // Only log slow queries (>100ms) in production; everything in dev
      if (process.env.NODE_ENV === 'production' && (timing ?? 0) < 100) return;
      logger.debug({ sql, timing_ms: timing }, 'sql');
    },
    benchmark: true,
    pool: {
      max: opts.poolMax ?? 10,
      min: opts.poolMin ?? 2,
      acquire: 30_000,
      idle: 10_000,
    },
    define: {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
      underscored: true,
      timestamps: true,
      paranoid: true,
    },
    dialectOptions:
      opts.dialect === 'mysql'
        ? { decimalNumbers: true, dateStrings: false }
        : { ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false },
  };

  // Read replica support — Sequelize routes SELECTs to read URL automatically
  if (opts.readUrl) {
    return new Sequelize({
      ...baseOptions,
      replication: {
        write: { url: opts.databaseUrl } as any,
        read: [{ url: opts.readUrl } as any],
      } as any,
    } as Options);
  }

  return new Sequelize(opts.databaseUrl, baseOptions);
}
