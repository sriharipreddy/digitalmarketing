import type { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import type { TrackService } from '../_services/track.service.js';
import { ValidationError } from '@marketing/shared-middleware';

const trackSchema = Joi.object({
  workspace_id: Joi.string().uuid().required(),
  anonymous_id: Joi.string().min(1).max(64).required(),
  user_id: Joi.string().uuid().optional(),
  contact_email: Joi.string().email({ tlds: { allow: false } }).optional(),
  event_name: Joi.string().min(1).max(100).required(),
  properties: Joi.object().unknown(true).optional(),
  page_url: Joi.string().uri({ scheme: ['http', 'https'] }).max(2000).optional(),
  referrer: Joi.string().uri({ scheme: ['http', 'https'] }).max(2000).optional().allow(''),
  timestamp: Joi.alternatives().try(Joi.date(), Joi.string()).optional(),
  utm_source: Joi.string().max(64).optional(),
  utm_medium: Joi.string().max(64).optional(),
  utm_campaign: Joi.string().max(255).optional(),
  utm_term: Joi.string().max(255).optional(),
  utm_content: Joi.string().max(255).optional(),
});

const batchSchema = Joi.object({
  events: Joi.array().items(trackSchema).min(1).max(100).required(),
});

export class TrackController {
  constructor(private trackService: TrackService) {}

  /** Public single-event ingestion. CORS-open so SDKs in the browser can call directly. */
  track = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = trackSchema.validate(req.body, { abortEarly: false });
      if (error) {
        return next(new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }));
      }
      const result = await this.trackService.ingest(value, {
        ip: req.ip,
        user_agent: req.headers['user-agent'] as string,
      });
      res.status(202).json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  /** Public batch ingestion — SDK flush endpoint. */
  trackBatch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = batchSchema.validate(req.body, { abortEarly: false });
      if (error) {
        return next(new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }));
      }
      const result = await this.trackService.ingestBatch(value.events, {
        ip: req.ip,
        user_agent: req.headers['user-agent'] as string,
      });
      res.status(202).json({ data: result });
    } catch (err) {
      next(err);
    }
  };
}
