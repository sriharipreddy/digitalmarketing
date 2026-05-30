import type { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import type { SegmentService } from '../_services/segment.service.js';
import { ValidationError, ForbiddenError } from '@marketing/shared-middleware';

const filterSchema = Joi.object({
  field: Joi.string().required(),
  op: Joi.string().valid(
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
    'in', 'nin', 'contains', 'starts_with', 'ends_with', 'exists', 'not_exists',
  ).required(),
  value: Joi.any().optional(),
});

const definitionSchema = Joi.object({
  filters: Joi.array().items(filterSchema).min(1).required(),
});

const createSchema = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  description: Joi.string().max(2000).allow(null, '').optional(),
  definition: definitionSchema.required(),
});

const previewSchema = Joi.object({
  definition: definitionSchema.required(),
  limit: Joi.number().integer().min(1).max(500).optional(),
});

function workspaceFromParams(req: Request): string {
  const param = req.params.workspace_id as string;
  if (param !== req.user!.workspace_id) {
    throw new ForbiddenError('Cross-workspace access denied');
  }
  return param;
}

export class SegmentController {
  constructor(private segments: SegmentService) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const rows = await this.segments.list(ws);
      res.json({ data: { segments: rows } });
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = createSchema.validate(req.body, { abortEarly: false });
      if (error) return next(new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }));
      const ws = workspaceFromParams(req);
      const row = await this.segments.create(ws, { ...value, created_by: req.user!.id });
      res.status(201).json({ data: { segment: row } });
    } catch (err) { next(err); }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      await this.segments.remove(ws, req.params.segment_id as string);
      res.status(204).end();
    } catch (err) { next(err); }
  };

  preview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = previewSchema.validate(req.body, { abortEarly: false });
      if (error) return next(new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }));
      const ws = workspaceFromParams(req);
      const result = await this.segments.preview(ws, value.definition, value.limit);
      res.json({ data: result });
    } catch (err) { next(err); }
  };

  members = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const limit = parseInt((req.query.limit as string) ?? '100', 10);
      const offset = parseInt((req.query.offset as string) ?? '0', 10);
      const result = await this.segments.members(ws, req.params.segment_id as string, { limit, offset });
      res.json({ data: result });
    } catch (err) { next(err); }
  };

  evaluate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const result = await this.segments.evaluate(ws, req.params.segment_id as string);
      res.json({ data: result });
    } catch (err) { next(err); }
  };
}
