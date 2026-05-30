import type { Models } from '../models/index.js';
import { NotFoundError, ValidationError } from '@marketing/shared-middleware';

export class ContactService {
  constructor(private models: Models) {}

  async list(workspaceId: string, opts: { limit?: number; offset?: number; q?: string; stage?: string }) {
    const where: any = { workspace_id: workspaceId };
    if (opts.stage) where.lifecycle_stage = opts.stage;
    const { rows, count } = await this.models.Contact.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: Math.min(opts.limit ?? 50, 200),
      offset: opts.offset ?? 0,
    });
    return { rows, total: count };
  }

  async get(workspaceId: string, id: string) {
    const c = await this.models.Contact.findOne({ where: { id, workspace_id: workspaceId } });
    if (!c) throw new NotFoundError('Contact not found');
    return c;
  }

  async create(workspaceId: string, input: {
    email?: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    company?: string;
    lifecycle_stage?: string;
    source?: string;
    tags?: string[];
    custom_fields?: Record<string, unknown>;
  }) {
    if (!input.email && !input.phone) {
      throw new ValidationError('Email or phone required', {
        email: ['Provide email or phone'],
      });
    }
    if (input.email) {
      const existing = await this.models.Contact.findOne({
        where: { workspace_id: workspaceId, email: input.email.toLowerCase().trim() },
      });
      if (existing) {
        throw new ValidationError('Contact already exists', { email: ['Already in CRM'] });
      }
    }
    return this.models.Contact.create({
      workspace_id: workspaceId,
      email: input.email?.toLowerCase().trim() ?? null,
      first_name: input.first_name ?? null,
      last_name: input.last_name ?? null,
      phone: input.phone ?? null,
      company: input.company ?? null,
      lifecycle_stage: (input.lifecycle_stage as any) ?? 'subscriber',
      source: input.source ?? 'manual',
      tags: input.tags ?? null,
      custom_fields: input.custom_fields ?? null,
    } as any);
  }

  async update(workspaceId: string, id: string, patch: Record<string, unknown>) {
    const c = await this.get(workspaceId, id);
    const allowed: Record<string, unknown> = {};
    for (const key of [
      'first_name',
      'last_name',
      'phone',
      'company',
      'lifecycle_stage',
      'tags',
      'custom_fields',
      'lead_score',
    ]) {
      if (key in patch) allowed[key] = patch[key];
    }
    await c.update(allowed);
    return c;
  }

  async remove(workspaceId: string, id: string) {
    const c = await this.get(workspaceId, id);
    await c.destroy();
    return { id, removed: true };
  }

  async unsubscribe(workspaceId: string, id: string) {
    const c = await this.get(workspaceId, id);
    if (!c.unsubscribed) {
      await c.update({ unsubscribed: true, unsubscribed_at: new Date() });
    }
    return c;
  }

  /**
   * Upsert by email from a form submission. Adds tags + nudges lifecycle.
   * Returns { contact, created: boolean }.
   */
  async upsertFromForm(
    workspaceId: string,
    input: {
      email?: string;
      first_name?: string;
      last_name?: string;
      phone?: string;
      company?: string;
      tags?: string[];
      lifecycle_stage?: string;
      source?: string;
      custom_fields?: Record<string, unknown>;
    },
  ): Promise<{ contact: any; created: boolean }> {
    if (!input.email && !input.phone) {
      throw new ValidationError('Email or phone required', { email: ['Provide one'] });
    }
    const emailNorm = input.email?.toLowerCase().trim();
    let contact = emailNorm
      ? await this.models.Contact.findOne({
          where: { workspace_id: workspaceId, email: emailNorm },
        })
      : null;
    if (contact) {
      const mergedTags = Array.from(new Set([...(contact.tags ?? []), ...(input.tags ?? [])]));
      await contact.update({
        first_name: contact.first_name ?? input.first_name ?? null,
        last_name: contact.last_name ?? input.last_name ?? null,
        phone: contact.phone ?? input.phone ?? null,
        company: contact.company ?? input.company ?? null,
        lifecycle_stage: rankStage(contact.lifecycle_stage, input.lifecycle_stage),
        tags: mergedTags.length ? mergedTags : null,
        custom_fields: { ...(contact.custom_fields ?? {}), ...(input.custom_fields ?? {}) },
      });
      return { contact, created: false };
    }
    contact = await this.models.Contact.create({
      workspace_id: workspaceId,
      email: emailNorm ?? null,
      first_name: input.first_name ?? null,
      last_name: input.last_name ?? null,
      phone: input.phone ?? null,
      company: input.company ?? null,
      lifecycle_stage: (input.lifecycle_stage as any) ?? 'lead',
      source: input.source ?? 'form',
      tags: input.tags ?? null,
      custom_fields: input.custom_fields ?? null,
    } as any);
    return { contact: contact!, created: true };
  }
}

const STAGE_ORDER = ['subscriber', 'lead', 'mql', 'sql', 'customer', 'evangelist', 'churned'];
function rankStage(current: string, incoming?: string): string {
  if (!incoming) return current;
  const ci = STAGE_ORDER.indexOf(current);
  const ii = STAGE_ORDER.indexOf(incoming);
  // Never demote (e.g. customer → lead), and "churned" only set explicitly.
  if (incoming === 'churned') return incoming;
  return ii > ci ? incoming : current;
}
