import type { Application } from 'express';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import { requestIdMiddleware } from './request-id.js';
import { requestLogger } from './logger.js';
import type pino from 'pino';

/**
 * Applies the standard middleware stack to an Express app.
 * Call BEFORE mounting routes; call errorHandler AFTER routes.
 */
export function applyBaseMiddleware(
  app: Application,
  opts: { logger: pino.Logger; corsOrigins?: string[] },
): void {
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // Trust first hop (Nginx)

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: false, // CSP configured per service / per route
      crossOriginEmbedderPolicy: false,
    }),
  );

  // CORS
  app.use(
    cors({
      origin: opts.corsOrigins ?? true,
      credentials: true,
    }),
  );

  // Compression — but skip for text/event-stream so SSE flushes immediately.
  app.use(
    compression({
      filter: (req: any, res: any) => {
        if (res.getHeader('Content-Type') === 'text/event-stream') return false;
        return compression.filter(req, res);
      },
    }) as any,
  );

  // Body parsing — note: webhook routes that need raw body must use
  // express.raw() inline BEFORE express.json() is applied to them
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser() as any);

  // Request tracing + logging
  app.use(requestIdMiddleware as any);
  app.use(requestLogger(opts.logger) as any);

  // Passport (no session — JWT only)
  app.use(passport.initialize() as any);
}
