import type { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import type { ExportService } from '../_services/export.service.js';
import { ValidationError, ForbiddenError } from '@marketing/shared-middleware';

/** Sequelize-MySQL returns JSON columns as strings — unwrap before serialising back to the client. */
function publicExport(row: any) {
  const json = row.toJSON ? row.toJSON() : row;
  if (typeof json.manifest === 'string') {
    try { json.manifest = JSON.parse(json.manifest); } catch { /* leave as-is */ }
  }
  return json;
}

const dsarSchema = Joi.object({
  subject_email: Joi.string().email().allow(null, '').optional(),
  subject_user_id: Joi.string().uuid().allow(null, '').optional(),
}).or('subject_email', 'subject_user_id');

function workspaceFromParams(req: Request): string {
  const param = req.params.workspace_id as string;
  if (param !== req.user!.workspace_id) {
    throw new ForbiddenError('Cross-workspace access denied');
  }
  return param;
}

export class ExportController {
  constructor(private exports: ExportService) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const rows = await this.exports.list(ws);
      res.json({ data: { exports: rows.map(publicExport) } });
    } catch (err) { next(err); }
  };

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ws = workspaceFromParams(req);
      const row = await this.exports.get(ws, req.params.export_id as string);
      res.json({ data: { export: publicExport(row) } });
    } catch (err) { next(err); }
  };

  createDsar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = dsarSchema.validate(req.body, { abortEarly: false });
      if (error) return next(new ValidationError('Validation failed', { fields: error.details.map((d) => d.message) }));
      const ws = workspaceFromParams(req);
      const row = await this.exports.createDsar(ws, { ...value, requested_by: req.user!.id });
      res.status(202).json({ data: { export: publicExport(row) } });
    } catch (err) { next(err); }
  };
}
