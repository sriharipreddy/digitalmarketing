import type { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import type { GoalService } from '../_services/goal.service.js';
import { ValidationError, ForbiddenError } from '@marketing/shared-middleware';

const createSchema = Joi.object({
  name: Joi.string().min(2).max(255).required(),
  description: Joi.string().max(1000).allow('').optional(),
  event_name: Joi.string().min(1).max(100).required(),
  property_filters: Joi.object().pattern(Joi.string(), Joi.string()).optional(),
  value_usd: Joi.number().min(0).max(1_000_000).optional(),
});

function workspaceFromParams(req: Request): string {
  const param = req.params.workspace_id as string;
  if (param !== req.user!.workspace_id) {
    throw new ForbiddenError('Cross-workspace access denied');
  }
  return param;
}

export class GoalController {
  constructor(private goalService: GoalService) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const goals = await this.goalService.list(ws);
      res.json({ data: { goals } });
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = createSchema.validate(req.body, { abortEarly: false });
      if (error) {
        return next(new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }));
      }
      const ws = workspaceFromParams(req);
      const goal = await this.goalService.create(ws, req.user!.id, value);
      res.status(201).json({ data: { goal } });
    } catch (err) {
      next(err);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const result = await this.goalService.remove(ws, req.params.goal_id as string);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };
}
