import type { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import type { ContentPieceService } from '../_services/content-piece.service.js';
import { ValidationError, ForbiddenError } from '@marketing/shared-middleware';

const KIND_VALUES = ['blog', 'social', 'email', 'ad_copy', 'headline', 'landing_page', 'press_release'];

const createSchema = Joi.object({
  kind: Joi.string().valid(...KIND_VALUES).required(),
  title: Joi.string().min(2).max(500).required(),
  body: Joi.string().min(1).max(100_000).required(),
  brand_voice_id: Joi.string().uuid().optional(),
  source_generation_id: Joi.string().uuid().optional(),
  language: Joi.string().min(2).max(5).optional(),
  tags: Joi.array().items(Joi.string()).optional(),
});

const fromGenSchema = Joi.object({
  generation_id: Joi.string().uuid().required(),
  title: Joi.string().min(2).max(500).optional(),
});

const updateSchema = Joi.object({
  title: Joi.string().min(2).max(500).optional(),
  body: Joi.string().min(1).max(100_000).optional(),
  status: Joi.string().valid('draft', 'in_review', 'scheduled', 'published', 'archived').optional(),
  scheduled_at: Joi.alternatives().try(Joi.date(), Joi.allow(null)).optional(),
  tags: Joi.array().items(Joi.string()).optional(),
}).min(1);

const translateSchema = Joi.object({
  target_language: Joi.string().min(2).max(5).required(),
});

function workspaceFromParams(req: Request): string {
  const param = req.params.workspace_id as string;
  if (param !== req.user!.workspace_id) {
    throw new ForbiddenError('Cross-workspace access denied');
  }
  return param;
}

export class ContentPieceController {
  constructor(private contentPieceService: ContentPieceService) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const limit = parseInt((req.query.limit as string) ?? '50', 10);
      const offset = parseInt((req.query.offset as string) ?? '0', 10);
      const status = req.query.status as string | undefined;
      const kind = req.query.kind as string | undefined;
      const result = await this.contentPieceService.list(ws, { limit, offset, status, kind });
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const p = await this.contentPieceService.get(ws, req.params.piece_id as string);
      res.json({ data: { piece: this.contentPieceService.publicPiece(p) } });
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
      const p = await this.contentPieceService.create(ws, req.user!.id, value);
      res.status(201).json({ data: { piece: this.contentPieceService.publicPiece(p) } });
    } catch (err) {
      next(err);
    }
  };

  createFromGeneration = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = fromGenSchema.validate(req.body, { abortEarly: false });
      if (error) {
        return next(new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }));
      }
      const ws = workspaceFromParams(req);
      const p = await this.contentPieceService.createFromGeneration(ws, req.user!.id, value.generation_id, value.title);
      res.status(201).json({ data: { piece: this.contentPieceService.publicPiece(p) } });
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = updateSchema.validate(req.body, { abortEarly: false });
      if (error) {
        return next(new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }));
      }
      const ws = workspaceFromParams(req);
      const p = await this.contentPieceService.update(ws, req.params.piece_id as string, value);
      res.json({ data: { piece: this.contentPieceService.publicPiece(p) } });
    } catch (err) {
      next(err);
    }
  };

  translate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = translateSchema.validate(req.body, { abortEarly: false });
      if (error) {
        return next(new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }));
      }
      const ws = workspaceFromParams(req);
      const p = await this.contentPieceService.translate(
        ws,
        req.user!.id,
        req.params.piece_id as string,
        value.target_language,
      );
      res.status(201).json({ data: { piece: this.contentPieceService.publicPiece(p) } });
    } catch (err) {
      next(err);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const result = await this.contentPieceService.remove(ws, req.params.piece_id as string);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };
}
