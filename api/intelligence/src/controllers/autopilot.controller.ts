import type { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import type { AutopilotService } from '../_services/autopilot.service.js';
import { ValidationError, ForbiddenError } from '@marketing/shared-middleware';

const actSchema = Joi.object({
  outcome: Joi.string().valid('accepted', 'dismissed', 'in_progress', 'completed').required(),
});

function workspaceFromParams(req: Request): string {
  const param = req.params.workspace_id as string;
  if (param !== req.user!.workspace_id) {
    throw new ForbiddenError('Cross-workspace access denied');
  }
  return param;
}

export class AutopilotController {
  constructor(private autopilotService: AutopilotService) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const status = req.query.status as string | undefined;
      const recommendations = await this.autopilotService.list(ws, { status });
      res.json({ data: { recommendations } });
    } catch (err) {
      next(err);
    }
  };

  scan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const result = await this.autopilotService.scan(ws);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  act = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = actSchema.validate(req.body, { abortEarly: false });
      if (error) {
        return next(new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }));
      }
      const ws = workspaceFromParams(req);
      const recommendation = await this.autopilotService.actOn(
        ws,
        req.params.recommendation_id as string,
        req.user!.id,
        value.outcome,
      );
      res.json({ data: { recommendation } });
    } catch (err) {
      next(err);
    }
  };
}
