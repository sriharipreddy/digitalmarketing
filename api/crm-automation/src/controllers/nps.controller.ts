import type { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import type { NpsService } from '../_services/nps.service.js';
import { ValidationError, ForbiddenError } from '@marketing/shared-middleware';

const submitSchema = Joi.object({
  score: Joi.number().integer().min(0).max(10).required(),
  email: Joi.string().email().allow(null, '').optional(),
  contact_id: Joi.string().uuid().allow(null, '').optional(),
  comment: Joi.string().max(4000).allow(null, '').optional(),
  survey_id: Joi.string().max(255).allow(null, '').optional(),
});

function workspaceFromParams(req: Request): string {
  const param = req.params.workspace_id as string;
  if (param !== req.user!.workspace_id) {
    throw new ForbiddenError('Cross-workspace access denied');
  }
  return param;
}

export class NpsController {
  constructor(private nps: NpsService) {}

  submit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = submitSchema.validate(req.body, { abortEarly: false });
      if (error) return next(new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }));
      const ws = workspaceFromParams(req);
      const row = await this.nps.submit(ws, value);
      res.status(201).json({ data: { response: row } });
    } catch (err) { next(err); }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const limit = parseInt((req.query.limit as string) ?? '200', 10);
      const rows = await this.nps.list(ws, { limit });
      res.json({ data: { responses: rows } });
    } catch (err) { next(err); }
  };

  summary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const s = await this.nps.summary(ws);
      res.json({ data: s });
    } catch (err) { next(err); }
  };
}
