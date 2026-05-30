import type { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import type { EventReceiverService } from '../_services/event-receiver.service.js';
import { ValidationError } from '@marketing/shared-middleware';

const eventSchema = Joi.object({
  workspace_id: Joi.string().uuid().required(),
  event_id: Joi.string().uuid().optional(),
  kind: Joi.string().min(1).max(64).required(),
  payload: Joi.object().unknown(true).required(),
});

export class EventController {
  constructor(private eventReceiver: EventReceiverService) {}

  receive = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = eventSchema.validate(req.body, { abortEarly: false });
      if (error) return next(new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }));
      const result = await this.eventReceiver.receive(value);
      res.status(202).json({ data: result });
    } catch (err) { next(err); }
  };
}
