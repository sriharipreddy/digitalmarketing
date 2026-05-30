import type { Sequelize } from 'sequelize';

export interface AudienceFilter {
  tag_includes?: string[];
  tag_excludes?: string[];
  lifecycle_in?: string[];
  source_match?: string;
}

/**
 * Resolves a filter to a list of contact emails by querying crm_contacts directly.
 * Same MySQL DB → no cross-service HTTP. The only contract we depend on is the
 * crm_contacts schema (workspace_id, email, lifecycle_stage, tags, source, unsubscribed).
 *
 * Contacts where unsubscribed=true are ALWAYS excluded.
 */
export class AudienceService {
  constructor(private sequelize: Sequelize) {}

  async resolve(workspaceId: string, filter: AudienceFilter): Promise<string[]> {
    const where: string[] = ['workspace_id = :ws', 'email IS NOT NULL', 'unsubscribed = false'];
    const replacements: Record<string, unknown> = { ws: workspaceId };

    if (filter.lifecycle_in?.length) {
      where.push('lifecycle_stage IN (:lc)');
      replacements.lc = filter.lifecycle_in;
    }
    if (filter.source_match) {
      where.push('source LIKE :src');
      replacements.src = `%${filter.source_match}%`;
    }

    const rows: any[] = await this.sequelize.query(
      `SELECT email, tags FROM crm_contacts WHERE ${where.join(' AND ')}`,
      { replacements, type: 'SELECT' as any },
    );

    // Tag filtering done in JS — JSON_CONTAINS is too brittle across MySQL versions
    // and the audience size is bounded.
    const tagsInc = filter.tag_includes ?? [];
    const tagsExc = filter.tag_excludes ?? [];
    const emails: string[] = [];
    const seen = new Set<string>();
    for (const r of rows) {
      const tags = parseTags(r.tags);
      if (tagsInc.length && !tagsInc.every((t) => tags.includes(t))) continue;
      if (tagsExc.length && tagsExc.some((t) => tags.includes(t))) continue;
      const email = String(r.email).toLowerCase();
      if (seen.has(email)) continue;
      seen.add(email);
      emails.push(email);
    }
    return emails;
  }

  /** Mark a contact unsubscribed (set unsubscribed=true + unsubscribed_at). */
  async markUnsubscribed(workspaceId: string | null, email: string): Promise<void> {
    const where: string[] = ['email = :em', 'unsubscribed = false'];
    const replacements: Record<string, unknown> = { em: email.toLowerCase() };
    if (workspaceId) {
      where.push('workspace_id = :ws');
      replacements.ws = workspaceId;
    }
    await this.sequelize.query(
      `UPDATE crm_contacts SET unsubscribed = true, unsubscribed_at = NOW()
        WHERE ${where.join(' AND ')}`,
      { replacements },
    );
  }
}

function parseTags(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value as string[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}
