import { ulid } from 'ulid';
import type { RequestHandler } from 'express';

declare module 'http' {
  interface IncomingMessage {
    id: string;
  }
}

export const requestIdMiddleware: RequestHandler = (req, res, next) => {
  const incoming = (req.headers['x-request-id'] as string | undefined) ?? '';
  req.id = incoming || ulid();
  res.setHeader('X-Request-Id', req.id);
  next();
};
