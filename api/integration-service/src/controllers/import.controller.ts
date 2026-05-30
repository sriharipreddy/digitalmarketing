import type { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import type { ImportService } from '../_services/import.service.js';
import {
  HubSpotImportDriver,
  MailchimpImportDriver,
  KlaviyoImportDriver,
  StubImportDriver,
  type ImportDriver,
} from '../_services/import.drivers.js';
import { ValidationError, ForbiddenError, BadRequestError } from '@marketing/shared-middleware';

const createSchema = Joi.object({
  source: Joi.string().valid('csv', 'hubspot', 'mailchimp', 'klaviyo').required(),
  entity: Joi.string().valid('contacts').required(),
  source_file_url: Joi.string().uri().allow(null, '').optional(),
  credentials_ref: Joi.string().max(255).allow(null, '').optional(),
  column_mapping: Joi.object().pattern(Joi.string(), Joi.string()).optional(),
});

const runSchema = Joi.object({
  // Source-specific fields. For dev/test, all of these are optional → falls back to stub driver.
  access_token: Joi.string().optional(),
  api_key: Joi.string().optional(),
  audience_id: Joi.string().optional(),
  dc: Joi.string().optional(),
  csv_body: Joi.string().optional(),
  column_mapping: Joi.object().pattern(Joi.string(), Joi.string()).optional(),
  use_stub: Joi.boolean().optional(),
});

function workspaceFromParams(req: Request): string {
  const param = req.params.workspace_id as string;
  if (param !== req.user!.workspace_id) {
    throw new ForbiddenError('Cross-workspace access denied');
  }
  return param;
}

export class ImportController {
  constructor(private imports: ImportService) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const rows = await this.imports.list(ws);
      res.json({ data: { imports: rows } });
    } catch (err) { next(err); }
  };

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const row = await this.imports.get(ws, req.params.import_id as string);
      res.json({ data: { import: row } });
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = createSchema.validate(req.body, { abortEarly: false });
      if (error) return next(new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }));
      const ws = workspaceFromParams(req);
      const row = await this.imports.create(ws, { ...value, created_by: req.user!.id });
      res.status(201).json({ data: { import: row } });
    } catch (err) { next(err); }
  };

  run = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = runSchema.validate(req.body, { abortEarly: false });
      if (error) return next(new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }));
      const ws = workspaceFromParams(req);
      const importId = req.params.import_id as string;
      const job = await this.imports.get(ws, importId);

      if (job.source === 'csv') {
        if (!value.csv_body) throw new BadRequestError('csv_body required for CSV imports');
        const mapping = value.column_mapping ?? job.column_mapping ?? {};
        const result = await this.imports.runCsv(ws, importId, value.csv_body, mapping);
        res.json({ data: result });
        return;
      }

      let driver: ImportDriver;
      if (value.use_stub) {
        driver = new StubImportDriver(job.source);
      } else if (job.source === 'hubspot') {
        if (!value.access_token) throw new BadRequestError('access_token required for hubspot');
        driver = new HubSpotImportDriver(value.access_token);
      } else if (job.source === 'mailchimp') {
        if (!value.api_key || !value.dc || !value.audience_id) {
          throw new BadRequestError('api_key, dc, audience_id required for mailchimp');
        }
        driver = new MailchimpImportDriver(value.api_key, value.dc, value.audience_id);
      } else if (job.source === 'klaviyo') {
        if (!value.api_key) throw new BadRequestError('api_key required for klaviyo');
        driver = new KlaviyoImportDriver(value.api_key);
      } else {
        throw new BadRequestError(`Unsupported source: ${job.source}`);
      }
      const result = await this.imports.runWithDriver(ws, importId, driver);
      res.json({ data: result });
    } catch (err) { next(err); }
  };
}
