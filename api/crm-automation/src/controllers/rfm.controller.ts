import type { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import type { RfmService } from '../_services/rfm.service.js';
import { ValidationError, ForbiddenError } from '@marketing/shared-middleware';

const analyzeSchema = Joi.object({
  orders: Joi.array().items(
    Joi.object({
      contact_id: Joi.string().uuid().required(),
      last_order_at: Joi.date().iso().allow(null).required(),
      order_count: Joi.number().integer().min(0).required(),
      lifetime_value_usd: Joi.number().min(0).required(),
    }),
  ).min(1).required(),
});

function workspaceFromParams(req: Request): string {
  const param = req.params.workspace_id as string;
  if (param !== req.user!.workspace_id) {
    throw new ForbiddenError('Cross-workspace access denied');
  }
  return param;
}

export class RfmController {
  constructor(private rfm: RfmService) {}

  analyze = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = analyzeSchema.validate(req.body, { abortEarly: false });
      if (error) return next(new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }));
      const ws = workspaceFromParams(req);
      const r = await this.rfm.analyze(ws, value.orders);
      res.json({ data: r });
    } catch (err) { next(err); }
  };

  summary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const s = await this.rfm.summary(ws);
      res.json({ data: s });
    } catch (err) { next(err); }
  };

  listBySegment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const rows = await this.rfm.listBySegment(ws, req.params.label as any);
      res.json({ data: { scores: rows } });
    } catch (err) { next(err); }
  };
}
