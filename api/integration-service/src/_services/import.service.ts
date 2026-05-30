import type { Models } from '../models/index.js';
import type { ImportDriver, ImportedContact } from './import.drivers.js';
import type { ImportSource } from '../models/import.model.js';
import { NotFoundError, ValidationError } from '@marketing/shared-middleware';

export interface CrmContactSink {
  /** Upsert one or more contacts. Returns succeeded + failed counts. */
  upsertBatch(workspaceId: string, contacts: ImportedContact[]): Promise<{ succeeded: number; failed: number }>;
}

export class ImportService {
  constructor(
    private models: Models,
    private sink: CrmContactSink,
    private logger: { info: (o: unknown, m?: string) => void; warn: (o: unknown, m?: string) => void; error: (o: unknown, m?: string) => void },
  ) {}

  async list(workspaceId: string) {
    return this.models.DataImport.findAll({
      where: { workspace_id: workspaceId },
      order: [['created_at', 'DESC']],
      limit: 100,
    });
  }

  async get(workspaceId: string, importId: string) {
    const row = await this.models.DataImport.findOne({ where: { id: importId, workspace_id: workspaceId } });
    if (!row) throw new NotFoundError('Import not found');
    return row;
  }

  /** Create an import row in `pending` state. Caller hands back the id and then
   * starts the run with `runWithDriver`. */
  async create(workspaceId: string, input: {
    source: ImportSource;
    entity: 'contacts';
    source_file_url?: string | null;
    credentials_ref?: string | null;
    column_mapping?: Record<string, string> | null;
    created_by?: string | null;
  }) {
    return this.models.DataImport.create({
      workspace_id: workspaceId,
      source: input.source,
      entity: input.entity,
      source_file_url: input.source_file_url ?? null,
      credentials_ref: input.credentials_ref ?? null,
      column_mapping: input.column_mapping ?? null,
      status: 'pending',
      created_by: input.created_by ?? null,
    } as any);
  }

  /** Run an import end-to-end: paginate the driver, batch upsert to CRM, update counters. */
  async runWithDriver(workspaceId: string, importId: string, driver: ImportDriver) {
    const job = await this.get(workspaceId, importId);
    await job.update({ status: 'processing', started_at: new Date() });
    let cursor: string | null = null;
    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    try {
      do {
        const batch: { rows: ImportedContact[]; nextCursor: string | null } = await driver.fetchContactsBatch(cursor);
        if (batch.rows.length > 0) {
          const r = await this.sink.upsertBatch(workspaceId, batch.rows);
          processed += batch.rows.length;
          succeeded += r.succeeded;
          failed += r.failed;
          await job.update({
            processed_rows: processed,
            succeeded_rows: succeeded,
            failed_rows: failed,
            total_rows: Math.max(processed, job.total_rows),
          });
        }
        cursor = batch.nextCursor;
      } while (cursor);
      await job.update({ status: 'completed', completed_at: new Date(), total_rows: processed });
      this.logger.info({ import_id: importId, processed, succeeded, failed }, 'import_completed');
      return { processed, succeeded, failed };
    } catch (e: any) {
      await job.update({ status: 'failed', error: e.message ?? 'unknown', completed_at: new Date() });
      this.logger.error({ import_id: importId, err: e.message }, 'import_failed');
      throw e;
    }
  }

  /** Parse a CSV body in-memory + run a stub-style import directly against the CRM sink. */
  async runCsv(workspaceId: string, importId: string, csvBody: string, mapping: Record<string, string>) {
    const job = await this.get(workspaceId, importId);
    await job.update({ status: 'processing', started_at: new Date() });
    try {
      const rows = parseCsv(csvBody);
      if (rows.length === 0) {
        throw new ValidationError('CSV had no rows', { csv: ['Empty body'] });
      }
      const header = rows[0]!;
      const dataRows = rows.slice(1);
      const contacts: ImportedContact[] = dataRows.map((cols) => {
        const fields: Record<string, string> = {};
        for (let i = 0; i < header.length; i++) fields[header[i]!] = cols[i] ?? '';
        const c: ImportedContact = {
          email: pick(fields, mapping.email) ?? null,
          first_name: pick(fields, mapping.first_name) ?? null,
          last_name: pick(fields, mapping.last_name) ?? null,
          phone: pick(fields, mapping.phone) ?? null,
          company: pick(fields, mapping.company) ?? null,
        };
        return c;
      });
      const r = await this.sink.upsertBatch(workspaceId, contacts);
      await job.update({
        status: 'completed',
        completed_at: new Date(),
        processed_rows: contacts.length,
        succeeded_rows: r.succeeded,
        failed_rows: r.failed,
        total_rows: contacts.length,
      });
      return { processed: contacts.length, succeeded: r.succeeded, failed: r.failed };
    } catch (e: any) {
      await job.update({ status: 'failed', error: e.message ?? 'unknown', completed_at: new Date() });
      throw e;
    }
  }
}

function pick(record: Record<string, string>, columnName: string | undefined): string | null {
  if (!columnName) return null;
  const v = record[columnName];
  return v && v.length > 0 ? v : null;
}

/**
 * Minimal RFC-4180 CSV parser. Handles quoted fields with embedded commas
 * and escaped double-quotes. Does NOT handle multiline quoted fields — we
 * draw the line there since SaaS CRM exports rarely produce them and any
 * CSV with newlines inside a value is a future migration story.
 */
function parseCsv(body: string): string[][] {
  const out: string[][] = [];
  const lines = body.replace(/\r\n/g, '\n').split('\n').filter((l) => l.length > 0);
  for (const line of lines) {
    const row: string[] = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuote) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; continue; }
        if (ch === '"') { inQuote = false; continue; }
        cur += ch;
      } else {
        if (ch === '"') { inQuote = true; continue; }
        if (ch === ',') { row.push(cur); cur = ''; continue; }
        cur += ch;
      }
    }
    row.push(cur);
    out.push(row);
  }
  return out;
}
