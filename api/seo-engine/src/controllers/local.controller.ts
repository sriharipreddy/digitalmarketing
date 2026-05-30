import type { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import type { LocalListingService } from '../_services/local-listing.service.js';
import type { CitationService } from '../_services/citation.service.js';
import { ValidationError, ForbiddenError } from '@marketing/shared-middleware';

const createListingSchema = Joi.object({
  provider: Joi.string().valid('gmb', 'apple_maps', 'bing_places', 'yelp').required(),
  provider_account_id: Joi.string().min(1).max(255).required(),
  business_name: Joi.string().min(1).max(255).required(),
  address_line1: Joi.string().max(255).allow(null, ''),
  city: Joi.string().max(120).allow(null, ''),
  region: Joi.string().max(120).allow(null, ''),
  postal_code: Joi.string().max(20).allow(null, ''),
  country: Joi.string().length(2).optional(),
  phone: Joi.string().max(40).allow(null, ''),
  website_url: Joi.string().uri().allow(null, ''),
  categories: Joi.array().items(Joi.string()).optional(),
  hours: Joi.object().unknown(true).optional(),
});

const respondSchema = Joi.object({
  body: Joi.string().min(1).max(4000).required(),
});

const citationStatusSchema = Joi.object({
  status: Joi.string().valid('pending', 'submitted', 'live', 'rejected').required(),
  submission_url: Joi.string().uri().allow(null, '').optional(),
});

function workspaceFromParams(req: Request): string {
  const param = req.params.workspace_id as string;
  if (param !== req.user!.workspace_id) {
    throw new ForbiddenError('Cross-workspace access denied');
  }
  return param;
}

export class LocalController {
  constructor(private listings: LocalListingService, private citations: CitationService) {}

  listListings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const rows = await this.listings.list(ws);
      res.json({ data: { listings: rows } });
    } catch (err) { next(err); }
  };

  createListing = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = createListingSchema.validate(req.body, { abortEarly: false });
      if (error) return next(new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }));
      const ws = workspaceFromParams(req);
      const row = await this.listings.create(ws, value);
      res.status(201).json({ data: { listing: row } });
    } catch (err) { next(err); }
  };

  removeListing = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      await this.listings.remove(ws, req.params.listing_id as string);
      res.status(204).end();
    } catch (err) { next(err); }
  };

  syncReviews = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const result = await this.listings.syncReviews(ws, req.params.listing_id as string);
      res.json({ data: result });
    } catch (err) { next(err); }
  };

  listReviews = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const rows = await this.listings.listReviews(ws, req.params.listing_id as string);
      res.json({ data: { reviews: rows } });
    } catch (err) { next(err); }
  };

  respondReview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = respondSchema.validate(req.body, { abortEarly: false });
      if (error) return next(new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }));
      const ws = workspaceFromParams(req);
      const row = await this.listings.respond(
        ws,
        req.params.listing_id as string,
        req.params.review_id as string,
        value.body,
      );
      res.json({ data: { review: row } });
    } catch (err) { next(err); }
  };

  listCitations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const rows = await this.citations.list(ws, req.params.listing_id as string);
      res.json({ data: { citations: rows } });
    } catch (err) { next(err); }
  };

  seedCitations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const result = await this.citations.seedDefaults(ws, req.params.listing_id as string);
      res.json({ data: result });
    } catch (err) { next(err); }
  };

  updateCitationStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = citationStatusSchema.validate(req.body, { abortEarly: false });
      if (error) return next(new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }));
      const ws = workspaceFromParams(req);
      const row = await this.citations.updateStatus(
        ws,
        req.params.citation_id as string,
        value.status,
        value.submission_url ?? null,
      );
      res.json({ data: { citation: row } });
    } catch (err) { next(err); }
  };
}
