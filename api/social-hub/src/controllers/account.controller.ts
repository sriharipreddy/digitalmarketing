import type { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import type { AccountService } from '../_services/account.service.js';
import { ValidationError, ForbiddenError } from '@marketing/shared-middleware';
import type { SocialPlatform } from '../models/account.model.js';

const PLATFORMS: SocialPlatform[] = ['facebook', 'instagram', 'twitter', 'linkedin', 'tiktok', 'youtube'];

const startSchema = Joi.object({
  platform: Joi.string().valid(...PLATFORMS).required(),
  redirect_uri: Joi.string().uri().required(),
});

const finishSchema = Joi.object({
  platform: Joi.string().valid(...PLATFORMS).required(),
  code: Joi.string().required(),
  state: Joi.string().required(),
});

function workspaceFromParams(req: Request): string {
  const param = req.params.workspace_id as string;
  if (param !== req.user!.workspace_id) {
    throw new ForbiddenError('Cross-workspace access denied');
  }
  return param;
}

export class AccountController {
  constructor(private accountService: AccountService) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const accounts = await this.accountService.list(ws);
      res.json({ data: { accounts } });
    } catch (err) {
      next(err);
    }
  };

  startConnect = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = startSchema.validate(req.body, { abortEarly: false });
      if (error) {
        return next(new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }));
      }
      const ws = workspaceFromParams(req);
      const result = await this.accountService.startConnect(ws, value.platform, value.redirect_uri);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  finishConnect = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = finishSchema.validate(req.body, { abortEarly: false });
      if (error) {
        return next(new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }));
      }
      const ws = workspaceFromParams(req);
      const account = await this.accountService.finishConnect(ws, req.user!.id, value.platform, value.code, value.state);
      res.status(201).json({ data: { account } });
    } catch (err) {
      next(err);
    }
  };

  disconnect = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const result = await this.accountService.disconnect(ws, req.params.account_id as string);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };
}
