import type { Sequelize } from 'sequelize';
import type { CrmContactSink } from './import.service.js';
import type { ImportedContact } from './import.drivers.js';

/**
 * Writes contacts directly into the shared `crm_contacts` table using raw SQL.
 * This is cleaner than coupling integration-service to the crm-automation
 * Sequelize model definition, and avoids the operational complexity of
 * service-to-service HMAC POSTs for bulk import paths (~thousands of rows).
 *
 * Idempotent on (workspace_id, email): existing rows update; new rows insert.
 */
export class CrmDirectSink implements CrmContactSink {
  constructor(private sequelize: Sequelize) {}

  async upsertBatch(workspaceId: string, contacts: ImportedContact[]): Promise<{ succeeded: number; failed: number }> {
    let succeeded = 0;
    let failed = 0;
    for (const c of contacts) {
      if (!c.email) { failed++; continue; }
      try {
        await this.sequelize.query(
          `
          INSERT INTO crm_contacts (
            id, workspace_id, email, first_name, last_name, phone, company,
            lifecycle_stage, source, lead_score, unsubscribed, created_at, updated_at
          ) VALUES (
            UUID(), :workspace_id, :email, :first_name, :last_name, :phone, :company,
            'subscriber', 'import', 0, FALSE, NOW(), NOW()
          )
          ON DUPLICATE KEY UPDATE
            first_name = COALESCE(VALUES(first_name), first_name),
            last_name  = COALESCE(VALUES(last_name),  last_name),
            phone      = COALESCE(VALUES(phone),      phone),
            company    = COALESCE(VALUES(company),    company),
            updated_at = NOW()
          `,
          {
            replacements: {
              workspace_id: workspaceId,
              email: c.email.toLowerCase(),
              first_name: c.first_name ?? null,
              last_name: c.last_name ?? null,
              phone: c.phone ?? null,
              company: c.company ?? null,
            },
          },
        );
        succeeded++;
      } catch {
        failed++;
      }
    }
    return { succeeded, failed };
  }
}
