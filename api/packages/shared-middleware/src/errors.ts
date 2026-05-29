import type { Request, Response, NextFunction } from 'express';
import type pino from 'pino';

export class AppError extends Error {
  status: number;
  code: string;
  details?: Record<string, unknown>;
  expose: boolean;

  constructor(opts: { message: string; status?: number; code?: string; details?: Record<string, unknown>; expose?: boolean }) {
    super(opts.message);
    this.status = opts.status ?? 500;
    this.code = opts.code ?? 'internal_error';
    this.details = opts.details;
    this.expose = opts.expose ?? this.status < 500;
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: Record<string, unknown>) {
    super({ message, status: 400, code: 'validation_failed', details, expose: true });
  }
}
export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super({ message, status: 401, code: 'authentication_required', expose: true });
  }
}
export class ForbiddenError extends AppError {
  constructor(message = 'Permission denied') {
    super({ message, status: 403, code: 'permission_denied', expose: true });
  }
}
export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super({ message, status: 404, code: 'not_found', expose: true });
  }
}
export class BadRequestError extends AppError {
  constructor(message: string, code = 'bad_request', details?: Record<string, unknown>) {
    super({ message, status: 400, code, details, expose: true });
  }
}

/**
 * Express error-handling middleware. Mount LAST (after all routes).
 * Logs the full error; returns a sanitised JSON envelope to the client.
 */
export function errorHandler(logger: pino.Logger) {
  return (err: any, req: Request, res: Response, _next: NextFunction): void => {
    const status = err.status ?? 500;
    const code = err.code ?? 'internal_error';
    const message = err.expose ? err.message : 'Internal server error';

    logger.error(
      {
        request_id: req.id,
        workspace_id: (req as any).workspaceId,
        error_code: code,
        status,
        err: { message: err.message, stack: err.stack },
      },
      'request_failed',
    );

    res.status(status).json({
      error: {
        code,
        message,
        details: err.details,
        request_id: req.id,
      },
    });
  };
}
