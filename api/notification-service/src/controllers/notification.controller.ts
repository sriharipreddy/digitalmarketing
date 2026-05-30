import type { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import type { NotificationService } from '../_services/notification.service.js';
import type { NotificationBus } from '../_services/bus.service.js';
import { ValidationError, ForbiddenError } from '@marketing/shared-middleware';

const publishSchema = Joi.object({
  workspace_id: Joi.string().uuid().required(),
  user_id: Joi.string().uuid().allow(null).optional(),
  kind: Joi.string().required(),
  severity: Joi.string().valid('info', 'success', 'warning', 'error').optional(),
  title: Joi.string().min(1).max(500).required(),
  body: Joi.string().max(2000).optional(),
  // Accept relative paths like "/dashboard/affiliate" as well as absolute URLs.
  action_url: Joi.string().max(2000).optional(),
  metadata: Joi.object().unknown(true).optional(),
  from_service: Joi.string().max(64).required(),
});

function workspaceFromParams(req: Request): string {
  const param = req.params.workspace_id as string;
  if (param !== req.user!.workspace_id) {
    throw new ForbiddenError('Cross-workspace access denied');
  }
  return param;
}

export class NotificationController {
  constructor(
    private notificationService: NotificationService,
    private bus: NotificationBus,
    private ssePingSeconds: number,
  ) {}

  /** INTERNAL — services publish here. Signature verified by authenticateInternal middleware. */
  publish = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = publishSchema.validate(req.body, { abortEarly: false });
      if (error) {
        return next(new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }));
      }
      const row = await this.notificationService.publish(value);
      res.status(201).json({ data: { notification: this.notificationService.publicNotification(row) } });
    } catch (err) {
      next(err);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const userId = req.user!.id;
      const limit = parseInt((req.query.limit as string) ?? '50', 10);
      const offset = parseInt((req.query.offset as string) ?? '0', 10);
      const unread_only = req.query.unread_only === 'true';
      const result = await this.notificationService.list(ws, userId, { unread_only, limit, offset });
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  unreadCount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const userId = req.user!.id;
      const count = await this.notificationService.unreadCount(ws, userId);
      res.json({ data: { count } });
    } catch (err) {
      next(err);
    }
  };

  markRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const userId = req.user!.id;
      const n = await this.notificationService.markRead(ws, userId, req.params.notification_id as string);
      res.json({ data: { notification: this.notificationService.publicNotification(n) } });
    } catch (err) {
      next(err);
    }
  };

  markAllRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const userId = req.user!.id;
      const result = await this.notificationService.markAllRead(ws, userId);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  /** SSE stream — long-lived. Closes when client disconnects. */
  stream = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const userId = req.user!.id;

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();

      const write = (event: string, data: unknown) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        (res as any).flush?.();
      };

      // 1. Initial hello so the client knows the channel is live
      write('open', { workspace_id: ws, user_id: userId, at: new Date().toISOString() });

      // 2. Subscribe to the bus
      const unsubscribe = this.bus.subscribe(ws, userId, (notification) => {
        write('notification', notification);
      });

      // 3. Periodic ping to keep proxies (Nginx/CDN) from cutting idle connections
      const pingInterval = setInterval(() => {
        res.write(`: ping ${Date.now()}\n\n`);
      }, this.ssePingSeconds * 1000);

      // 4. Clean up on disconnect
      const cleanup = () => {
        clearInterval(pingInterval);
        unsubscribe();
      };
      res.on('close', cleanup);
      res.on('error', cleanup);
    } catch (err) {
      next(err);
    }
  };
}
