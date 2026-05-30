import type { Models } from '../models/index.js';
import type { SegmentDefinition, SegmentFilter } from '../models/segment.model.js';
import { NotFoundError, ValidationError } from '@marketing/shared-middleware';

const ALLOWED_FIELDS = new Set([
  'email', 'first_name', 'last_name', 'phone', 'company',
  'lifecycle_stage', 'source', 'lead_score', 'tags', 'unsubscribed',
  'created_at', 'updated_at',
]);

export class SegmentService {
  constructor(private models: Models) {}

  async list(workspaceId: string) {
    return this.models.Segment.findAll({
      where: { workspace_id: workspaceId },
      order: [['created_at', 'DESC']],
    });
  }

  async create(workspaceId: string, input: { name: string; description?: string; definition: SegmentDefinition; created_by?: string }) {
    this.validateDefinition(input.definition);
    const row = await this.models.Segment.create({
      workspace_id: workspaceId,
      name: input.name,
      description: input.description ?? null,
      definition: input.definition,
      member_count: 0,
      created_by: input.created_by ?? null,
    } as any);
    // Evaluate immediately so the dashboard renders a non-zero count.
    await this.evaluate(workspaceId, row.id);
    return row;
  }

  async remove(workspaceId: string, segmentId: string) {
    const row = await this.models.Segment.findOne({ where: { id: segmentId, workspace_id: workspaceId } });
    if (!row) throw new NotFoundError('Segment not found');
    await row.destroy();
  }

  /** Run the segment definition against the contacts table and update member_count. */
  async evaluate(workspaceId: string, segmentId: string) {
    const seg = await this.models.Segment.findOne({ where: { id: segmentId, workspace_id: workspaceId } });
    if (!seg) throw new NotFoundError('Segment not found');
    const def = parseDefinition(seg.definition);
    const members = await this.queryMembers(workspaceId, def);
    await seg.update({ member_count: members.length, last_evaluated_at: new Date() });
    return { count: members.length };
  }

  async preview(workspaceId: string, definition: SegmentDefinition, limit = 25) {
    this.validateDefinition(definition);
    const all = await this.queryMembers(workspaceId, definition);
    return { count: all.length, sample: all.slice(0, limit) };
  }

  async members(workspaceId: string, segmentId: string, opts: { limit?: number; offset?: number } = {}) {
    const seg = await this.models.Segment.findOne({ where: { id: segmentId, workspace_id: workspaceId } });
    if (!seg) throw new NotFoundError('Segment not found');
    const def = parseDefinition(seg.definition);
    const all = await this.queryMembers(workspaceId, def);
    const offset = opts.offset ?? 0;
    const limit = opts.limit ?? 100;
    return { total: all.length, rows: all.slice(offset, offset + limit) };
  }

  private validateDefinition(def: SegmentDefinition) {
    if (!def?.filters || !Array.isArray(def.filters) || def.filters.length === 0) {
      throw new ValidationError('At least one filter required', { filters: ['Required'] });
    }
    for (const f of def.filters) {
      if (!ALLOWED_FIELDS.has(f.field)) {
        throw new ValidationError(`Field ${f.field} not allowed in segments`, { field: [f.field] });
      }
    }
  }

  /**
   * In-process segment evaluator. Loads contacts into memory and filters in JS.
   * Trades raw scale for flexibility — the legacy SQL approach couldn't express
   * JSON-field membership cleanly across MySQL/PG. For workspaces over ~100k contacts
   * we'd swap this for a materialised contact-feature table and SQL.
   */
  private async queryMembers(workspaceId: string, def: SegmentDefinition) {
    const contacts = await this.models.Contact.findAll({ where: { workspace_id: workspaceId } });
    return contacts.filter((c: any) => def.filters.every((f) => matches(c, f)));
  }
}

/**
 * Sequelize-MySQL returns JSON columns as strings in some configurations.
 * Normalise to an object before reading `.filters` so downstream code sees the
 * same shape regardless of how the row came back.
 */
function parseDefinition(value: SegmentDefinition | string | null | undefined): SegmentDefinition {
  if (!value) return { filters: [] };
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return { filters: [] }; }
  }
  return value;
}

function matches(contact: Record<string, any>, f: SegmentFilter): boolean {
  // Tags column may also come back as a JSON string — normalise before comparing.
  if (f.field === 'tags' && typeof contact.tags === 'string') {
    try { contact = { ...contact, tags: JSON.parse(contact.tags) }; }
    catch { /* fall through with raw string */ }
  }
  const v = contact[f.field];
  switch (f.op) {
    case 'eq': return v === f.value;
    case 'neq': return v !== f.value;
    case 'gt': return typeof v === 'number' && v > Number(f.value);
    case 'gte': return typeof v === 'number' && v >= Number(f.value);
    case 'lt': return typeof v === 'number' && v < Number(f.value);
    case 'lte': return typeof v === 'number' && v <= Number(f.value);
    case 'in': return Array.isArray(f.value) && (f.value as unknown[]).includes(v);
    case 'nin': return Array.isArray(f.value) && !(f.value as unknown[]).includes(v);
    case 'contains':
      if (Array.isArray(v)) return v.includes(f.value as never);
      return typeof v === 'string' && typeof f.value === 'string' && v.toLowerCase().includes(f.value.toLowerCase());
    case 'starts_with': return typeof v === 'string' && typeof f.value === 'string' && v.toLowerCase().startsWith(f.value.toLowerCase());
    case 'ends_with': return typeof v === 'string' && typeof f.value === 'string' && v.toLowerCase().endsWith(f.value.toLowerCase());
    case 'exists': return v != null && v !== '';
    case 'not_exists': return v == null || v === '';
    default: return false;
  }
}
