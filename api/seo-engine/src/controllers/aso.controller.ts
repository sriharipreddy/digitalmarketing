import type { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import type { AsoService } from '../_services/aso.service.js';
import { ValidationError, ForbiddenError } from '@marketing/shared-middleware';

const trackSchema = Joi.object({
  platform: Joi.string().valid('ios', 'android').required(),
  app_external_id: Joi.string().min(1).max(255).required(),
});

function workspaceFromParams(req: Request): string {
  const param = req.params.workspace_id as string;
  if (param !== req.user!.workspace_id) {
    throw new ForbiddenError('Cross-workspace access denied');
  }
  return param;
}

export class AsoController {
  constructor(private aso: AsoService) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const rows = await this.aso.list(ws);
      res.json({ data: { apps: rows } });
    } catch (err) { next(err); }
  };

  track = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = trackSchema.validate(req.body, { abortEarly: false });
      if (error) return next(new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }));
      const ws = workspaceFromParams(req);
      const row = await this.aso.track(ws, value.platform, value.app_external_id);
      res.status(201).json({ data: { app: row } });
    } catch (err) { next(err); }
  };

  sync = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const row = await this.aso.sync(ws, req.params.app_id as string);
      res.json({ data: { app: row } });
    } catch (err) { next(err); }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      await this.aso.remove(ws, req.params.app_id as string);
      res.status(204).end();
    } catch (err) { next(err); }
  };
}
