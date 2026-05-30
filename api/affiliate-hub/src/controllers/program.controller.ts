import type { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import type { ProgramService } from '../_services/program.service.js';
import { ValidationError, ForbiddenError } from '@marketing/shared-middleware';

const createSchema = Joi.object({
  name: Joi.string().min(2).max(255).required(),
  description: Joi.string().max(2000).allow('').optional(),
  commission_kind: Joi.string().valid('percent', 'fixed_usd').optional(),
  commission_value: Joi.number().min(0).max(100_000).optional(),
  attribution: Joi.string().valid('first_click', 'last_click').optional(),
  cookie_days: Joi.number().integer().min(1).max(365).optional(),
  terms_url: Joi.string().uri().max(2000).optional(),
});

const updateSchema = Joi.object({
  status: Joi.string().valid('draft', 'active', 'paused', 'archived').optional(),
  commission_value: Joi.number().min(0).optional(),
  cookie_days: Joi.number().integer().min(1).max(365).optional(),
  description: Joi.string().max(2000).allow('').optional(),
}).min(1);

function workspaceFromParams(req: Request): string {
  const param = req.params.workspace_id as string;
  if (param !== req.user!.workspace_id) {
    throw new ForbiddenError('Cross-workspace access denied');
  }
  return param;
}

export class ProgramController {
  constructor(private programService: ProgramService) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const programs = await this.programService.list(ws);
      res.json({ data: { programs } });
    } catch (err) { next(err); }
  };

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const program = await this.programService.get(ws, req.params.program_id as string);
      res.json({ data: { program } });
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = createSchema.validate(req.body, { abortEarly: false });
      if (error) return next(new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }));
      const ws = workspaceFromParams(req);
      const program = await this.programService.create(ws, req.user!.id, value);
      res.status(201).json({ data: { program } });
    } catch (err) { next(err); }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = updateSchema.validate(req.body, { abortEarly: false });
      if (error) return next(new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }));
      const ws = workspaceFromParams(req);
      const program = await this.programService.update(ws, req.params.program_id as string, value);
      res.json({ data: { program } });
    } catch (err) { next(err); }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const result = await this.programService.remove(ws, req.params.program_id as string);
      res.json({ data: result });
    } catch (err) { next(err); }
  };
}
