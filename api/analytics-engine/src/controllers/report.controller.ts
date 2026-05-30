import type { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import type { ReportService } from '../_services/report.service.js';
import { ValidationError, ForbiddenError } from '@marketing/shared-middleware';

const funnelSchema = Joi.object({
  events: Joi.array().items(Joi.string()).min(1).max(8).required(),
  days: Joi.number().integer().min(1).max(365).optional(),
});

function workspaceFromParams(req: Request): string {
  const param = req.params.workspace_id as string;
  if (param !== req.user!.workspace_id) {
    throw new ForbiddenError('Cross-workspace access denied');
  }
  return param;
}

function parseRange(req: Request): { since: Date; until: Date } {
  const days = parseInt((req.query.days as string) ?? '30', 10);
  const until = new Date();
  const since = new Date(until.getTime() - Math.max(1, Math.min(365, days)) * 24 * 60 * 60 * 1000);
  return { since, until };
}

export class ReportController {
  constructor(private reportService: ReportService) {}

  overview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const { since, until } = parseRange(req);
      const result = await this.reportService.overview(ws, since, until);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  utm = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const { since, until } = parseRange(req);
      const result = await this.reportService.utmAttribution(ws, since, until);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  funnel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = funnelSchema.validate(req.body, { abortEarly: false });
      if (error) {
        return next(new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }));
      }
      const ws = workspaceFromParams(req);
      const days = value.days ?? 30;
      const until = new Date();
      const since = new Date(until.getTime() - days * 24 * 60 * 60 * 1000);
      const result = await this.reportService.funnel(ws, since, until, value.events);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };
}
