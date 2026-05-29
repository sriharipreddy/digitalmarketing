import 'dotenv/config';
import { cleanEnv, str, port, num, bool } from 'envalid';

/**
 * Common config every service needs. Each service extends this with
 * service-specific vars via its own `cleanEnv()` call.
 *
 * Database connection can be supplied two ways:
 *   1. DATABASE_URL — full connection string (overrides parts)
 *   2. DB_HOST + DB_PORT + DB_USER + DB_PASS + DB_NAME — parts (preferred for ops)
 *      → assembled into DATABASE_URL by `resolveDatabaseUrl()` below
 */
const raw = cleanEnv(process.env, {
  NODE_ENV: str({ choices: ['development', 'test', 'staging', 'production'], default: 'development' }),
  SERVICE_NAME: str(),
  PORT: port(),
  LOG_LEVEL: str({ default: 'info' }),

  // ─── Database ────────────────────────────────────────────────────────
  DB_DIALECT: str({ choices: ['mysql', 'postgres'], default: 'mysql' }),
  DATABASE_URL: str({ default: '' }),
  DATABASE_READ_URL: str({ default: '' }),
  DB_NAME: str({ default: '' }),
  DB_USER: str({ default: '' }),
  DB_PASS: str({ default: '' }),
  DB_HOST: str({ default: '' }),
  DB_PORT: port({ default: 3306 }),
  DB_POOL_MAX: num({ default: 10 }),
  DB_POOL_MIN: num({ default: 2 }),
  RESET_DB: bool({ default: false }),

  // ─── Redis ───────────────────────────────────────────────────────────
  REDIS_URL: str({ default: 'redis://127.0.0.1:6379' }),
  REDIS_HOST: str({ default: '127.0.0.1' }),
  REDIS_PORT: port({ default: 6379 }),
  REDIS_USERNAME: str({ default: '' }),
  REDIS_PASSWORD: str({ default: '' }),
  REDIS_DB: num({ default: 0 }),
  REDIS_TLS: bool({ default: false }),
  REDIS_KEY_PREFIX: str({ default: 'digi:' }),

  // ─── Auth ────────────────────────────────────────────────────────────
  JWT_SECRET: str(),
  JWT_ACCESS_TOKEN_LIFETIME: str({ default: '15m' }),
  JWT_REFRESH_TOKEN_LIFETIME: str({ default: '30d' }),

  // ─── Encryption ──────────────────────────────────────────────────────
  MASTER_DEK_HEX: str({ default: '' }),

  // ─── Storage ─────────────────────────────────────────────────────────
  STORAGE_DRIVER: str({ choices: ['s3', 'local'], default: 'local' }),
  STORAGE_PUBLIC_URL_BASE: str({ default: 'http://localhost:3100' }),
  S3_REGION: str({ default: '' }),
  S3_BUCKET: str({ default: '' }),
  S3_ENDPOINT: str({ default: '' }),
  S3_ACCESS_KEY_ID: str({ default: '' }),
  S3_SECRET_ACCESS_KEY: str({ default: '' }),
  S3_FORCE_PATH_STYLE: bool({ default: false }),
  LOCAL_STORAGE_PATH: str({ default: './.local-storage' }),
  LOCAL_STORAGE_PUBLIC_PATH_PREFIX: str({ default: '/files' }),

  // ─── Observability ───────────────────────────────────────────────────
  SENTRY_DSN: str({ default: '' }),
  OTEL_EXPORTER_OTLP_ENDPOINT: str({ default: '' }),
});

/**
 * Resolve the final DATABASE_URL.
 * - If DATABASE_URL is set, use it as-is
 * - Otherwise, assemble it from DB_HOST/USER/PASS/NAME/PORT
 *
 * Special-character handling: passwords often contain '@', '!', '#' — we
 * URL-encode them so they don't break the connection-string parser.
 */
function resolveDatabaseUrl(): string {
  if (raw.DATABASE_URL) return raw.DATABASE_URL;
  if (!raw.DB_HOST || !raw.DB_USER || !raw.DB_NAME) {
    throw new Error(
      'Database not configured. Set either DATABASE_URL, or DB_HOST + DB_USER + DB_PASS + DB_NAME.',
    );
  }
  const user = encodeURIComponent(raw.DB_USER);
  const pass = encodeURIComponent(raw.DB_PASS);
  const proto = raw.DB_DIALECT === 'postgres' ? 'postgres' : 'mysql';
  return `${proto}://${user}:${pass}@${raw.DB_HOST}:${raw.DB_PORT}/${raw.DB_NAME}`;
}

export const commonEnv = {
  ...raw,
  DATABASE_URL: resolveDatabaseUrl(),
};

export type CommonEnv = typeof commonEnv;

export { cleanEnv, str, port, num, bool } from 'envalid';
