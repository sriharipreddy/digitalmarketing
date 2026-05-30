import type { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import type { ListService } from '../_services/list.service.js';
import { ValidationError, ForbiddenError } from '@marketing/shared-middleware';

const filterSchema = Joi.object({
  tag_includes: Joi.array().items(Joi.string()).optional(),
  tag_excludes: Joi.array().items(Joi.string()).optional(),
  lifecycle_in: Joi.array().items(Joi.string()).optional(),
  source_match: Joi.string().max(64).optional(),
});

const createSchema = Joi.object({
  name: Joi.string().min(2).max(255).required(),
  description: Joi.string().max(1000).allow('').optional(),
  filter: filterSchema.required(),
});

const previewSchema = Joi.object({
  filter: filterSchema.required(),
});

function workspaceFromParams(req: Request): string {
  const param = req.params.workspace_id as string;
  if (param !== req.user!.workspace_id) {
    throw new ForbiddenError('Cross-workspace access denied');
  }
  return param;
}

export class ListController {
  constructor(private listService: ListService) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const lists = await this.listService.list(ws);
      res.json({ data: { lists } });
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
      const list = await this.listService.create(ws, req.user!.id, value);
      res.status(201).json({ data: { list } });
    } catch (err) {
      next(err);
    }
  };

  preview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const result = await this.listService.preview(ws, req.params.list_id as string);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  previewFilter = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = previewSchema.validate(req.body, { abortEarly: false });
      if (error) {
        return next(new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }));
      }
      const ws = workspaceFromParams(req);
      const result = await this.listService.previewFilter(ws, value.filter);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const result = await this.listService.remove(ws, req.params.list_id as string);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };
}
