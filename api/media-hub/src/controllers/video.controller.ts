import type { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import type { VideoService } from '../_services/video.service.js';
import { ValidationError, ForbiddenError } from '@marketing/shared-middleware';

const importSchema = Joi.object({
  url: Joi.string().min(1).max(2000).required(),
});

const transcribeSchema = Joi.object({
  audio_url: Joi.string().uri({ scheme: ['http', 'https'] }).max(2000).optional(),
});

function workspaceFromParams(req: Request): string {
  const param = req.params.workspace_id as string;
  if (param !== req.user!.workspace_id) {
    throw new ForbiddenError('Cross-workspace access denied');
  }
  return param;
}

export class VideoController {
  constructor(private videoService: VideoService) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const limit = parseInt((req.query.limit as string) ?? '25', 10);
      const offset = parseInt((req.query.offset as string) ?? '0', 10);
      const source = req.query.source as string | undefined;
      const result = await this.videoService.list(ws, { limit, offset, source });
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const video = await this.videoService.get(ws, req.params.video_id as string);
      res.json({ data: { video } });
    } catch (err) {
      next(err);
    }
  };

  importYouTube = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = importSchema.validate(req.body, { abortEarly: false });
      if (error) {
        return next(new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }));
      }
      const ws = workspaceFromParams(req);
      const video = await this.videoService.importYouTube(ws, req.user!.id, value.url);
      res.status(201).json({ data: { video } });
    } catch (err) {
      next(err);
    }
  };

  transcribe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = transcribeSchema.validate(req.body ?? {}, { abortEarly: false });
      if (error) {
        return next(new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }));
      }
      const ws = workspaceFromParams(req);
      const video = await this.videoService.transcribe(ws, req.params.video_id as string, value.audio_url);
      res.json({ data: { video } });
    } catch (err) {
      next(err);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const result = await this.videoService.remove(ws, req.params.video_id as string);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };
}
