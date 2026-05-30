import type { Sequelize } from 'sequelize';
import type { Models } from '../models/index.js';
import { NotFoundError, ValidationError } from '@marketing/shared-middleware';

const DSAR_TTL_HOURS = 72;

/**
 * Builds a DSAR export — a JSON dossier covering every record we hold about
 * a data subject (contact email, user id, or both). The build happens
 * synchronously here for simplicity; in production this would enqueue a worker
 * that writes to S3 and emails the requester a presigned link.
 *
 * Tables surveyed:
 *   - core_users, core_workspace_members  (the user record itself)
 *   - crm_contacts                         (CRM identity)
 *   - email_subscribers                    (mailing-list state)
 *   - email_sends → email_events           (per-email activity)
 *   - messaging_sends                      (SMS / WhatsApp / push log)
 *
 * NOT included: encrypted-at-rest fields (token blobs) — those are surfaced
 * by a separate compliance-sensitive flow.
 */
export class ExportService {
  constructor(
    private sequelize: Sequelize,
    private models: Models,
    private logger: { info: (o: unknown, m?: string) => void; error: (o: unknown, m?: string) => void },
  ) {}

  async list(workspaceId: string) {
    return this.models.DataExport.findAll({
      where: { workspace_id: workspaceId },
      order: [['created_at', 'DESC']],
      limit: 100,
    });
  }

  async get(workspaceId: string, exportId: string) {
    const row = await this.models.DataExport.findOne({ where: { id: exportId, workspace_id: workspaceId } });
    if (!row) throw new NotFoundError('Export not found');
    return row;
  }

  async createDsar(workspaceId: string, input: { subject_email?: string; subject_user_id?: string; requested_by?: string }) {
    if (!input.subject_email && !input.subject_user_id) {
      throw new ValidationError('subject_email or subject_user_id required', { subject: ['One is required'] });
    }
    const row = await this.models.DataExport.create({
      workspace_id: workspaceId,
      kind: 'dsar',
      subject_email: input.subject_email?.toLowerCase() ?? null,
      subject_user_id: input.subject_user_id ?? null,
      requested_by: input.requested_by ?? null,
      status: 'building',
    } as any);
    // Inline build for simplicity.
    void this.buildDsar(row.id).catch((e) => {
      this.logger.error({ export_id: row.id, err: e.message }, 'dsar_build_failed');
    });
    return row;
  }

  /** Construct the manifest by issuing read-only SELECTs across the data plane. */
  private async buildDsar(exportId: string): Promise<void> {
    const row = await this.models.DataExport.findByPk(exportId);
    if (!row) return;
    try {
      const manifest: Record<string, unknown> = { built_at: new Date().toISOString() };
      const email = row.subject_email;
      const userId = row.subject_user_id;
      const ws = row.workspace_id;

      manifest.subject = { workspace_id: ws, email, user_id: userId };

      if (email) {
        manifest.crm_contacts = await this.safeSelect(
          `SELECT id, email, first_name, last_name, phone, company, lifecycle_stage, source, lead_score,
                  tags, custom_fields, unsubscribed, unsubscribed_at, created_at, updated_at
             FROM crm_contacts WHERE workspace_id = :ws AND email = :email`,
          { ws, email },
        );
        manifest.email_subscribers = await this.safeSelect(
          `SELECT id, list_id, email, first_name, last_name, status, unsub_token, created_at
             FROM email_subscribers WHERE workspace_id = :ws AND email = :email`,
          { ws, email },
        );
        manifest.email_events = await this.safeSelect(
          `SELECT id, send_id, kind, recipient, occurred_at FROM email_events
             WHERE send_id IN (SELECT id FROM email_sends WHERE workspace_id = :ws)
               AND recipient = :email
             ORDER BY occurred_at DESC LIMIT 1000`,
          { ws, email },
        );
        manifest.messaging_sends = await this.safeSelect(
          `SELECT id, channel, to_address, status, sent_at, delivered_at, created_at
             FROM messaging_sends WHERE workspace_id = :ws AND to_address = :email
             ORDER BY created_at DESC LIMIT 1000`,
          { ws, email },
        );
        manifest.nps_responses = await this.safeSelect(
          `SELECT id, score, bucket, comment, submitted_at FROM crm_nps_responses
             WHERE workspace_id = :ws AND email = :email
             ORDER BY submitted_at DESC LIMIT 1000`,
          { ws, email },
        );
      }
      if (userId) {
        manifest.core_user = await this.safeSelect(
          `SELECT id, full_name, user_email, type, status, email_verified, preferred_locale, last_login_at, created_at
             FROM core_users WHERE id = :userId`,
          { userId },
        );
        manifest.workspace_memberships = await this.safeSelect(
          `SELECT workspace_id, role, status, created_at FROM core_workspace_members WHERE user_id = :userId`,
          { userId },
        );
      }

      const expires = new Date(Date.now() + DSAR_TTL_HOURS * 3600 * 1000);
      await row.update({
        status: 'ready',
        manifest,
        // In real life this would be the S3 presigned URL; in dev we surface the manifest inline.
        file_url: null,
        expires_at: expires,
      });
      this.logger.info({ export_id: row.id, expires }, 'dsar_built');
    } catch (e: any) {
      await row.update({ status: 'failed', error: e.message ?? 'unknown' });
      throw e;
    }
  }

  private async safeSelect(sql: string, replacements: Record<string, unknown>): Promise<unknown[]> {
    try {
      const [rows] = await this.sequelize.query(sql, { replacements });
      return rows as unknown[];
    } catch (e: any) {
      // Table may not exist in this dev DB — return empty rather than failing the whole DSAR.
      this.logger.info({ sql: sql.slice(0, 80), err: e.message }, 'dsar_safe_select_skipped');
      return [];
    }
  }
}
