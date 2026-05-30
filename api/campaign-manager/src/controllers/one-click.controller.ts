import type { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import type { OneClickService } from '../_services/one-click.service.js';
import { ValidationError, ForbiddenError } from '@marketing/shared-middleware';

const startSchema = Joi.object({
  source_url: Joi.string().min(3).max(2000).required(),
  product_pitch: Joi.string().min(10).max(2000).required(),
  audience_country: Joi.string().length(2).uppercase().optional(),
});

function workspaceFromParams(req: Request): string {
  const param = req.params.workspace_id as string;
  if (param !== req.user!.workspace_id) {
    throw new ForbiddenError('Cross-workspace access denied');
  }
  return param;
}

export class OneClickController {
  constructor(private oneClickService: OneClickService) {}

  /**
   * POST /one-click — body has the input; we stream SSE responses.
   * The dashboard JWT is forwarded to peer services to preserve auth +
   * workspace membership checks.
   */
  start = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = startSchema.validate(req.body, { abortEarly: false });
      if (error) {
        return next(new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }));
      }
      const ws = workspaceFromParams(req);

      // Extract the user's JWT to forward downstream.
      const auth = req.headers.authorization;
      const userJwt = auth?.startsWith('Bearer ') ? auth.slice(7) : '';
      if (!userJwt) {
        return next(new ValidationError('Missing user JWT', { auth: ['Required for orchestrator'] }));
      }

      // Start SSE.
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Nginx hint
      res.flushHeaders();

      const writeEvent = (event: string, data: unknown): boolean => {
        const ok = res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        // Force flush so the client sees each step in real time. Without this,
        // small SSE frames get coalesced and only deliver on connection close.
        (res as any).flush?.();
        return ok;
      };

      writeEvent('start', { workspace_id: ws, started_at: new Date().toISOString() });

      let clientGone = false;
      res.on('close', () => {
        clientGone = true;
      });

      try {
        const generator = this.oneClickService.run({
          workspace_id: ws,
          user_id: req.user!.id,
          user_jwt: userJwt,
          source_url: value.source_url,
          product_pitch: value.product_pitch,
          audience_country: value.audience_country,
        });

        for (;;) {
          const next = await generator.next();
          if (clientGone) break;
          if (next.done) {
            writeEvent('done', next.value);
            break;
          }
          writeEvent('step', next.value);
        }
      } catch (err: any) {
        writeEvent('error', { message: err.message });
      } finally {
        res.end();
      }
    } catch (err) {
      next(err);
    }
  };
}
