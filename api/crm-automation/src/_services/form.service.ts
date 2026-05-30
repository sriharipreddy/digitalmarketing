import crypto from 'node:crypto';
import type { Models } from '../models/index.js';
import type { ContactService } from './contact.service.js';
import {
  NotFoundError,
  ValidationError,
  BadRequestError,
} from '@marketing/shared-middleware';
import type { FormFieldSpec } from '../models/form.model.js';

const VALID_FIELD_TYPES: FormFieldSpec['type'][] = ['text', 'email', 'tel', 'textarea', 'select', 'checkbox'];

export class FormService {
  constructor(
    private models: Models,
    private contactService: ContactService,
  ) {}

  async list(workspaceId: string) {
    const forms = await this.models.LeadForm.findAll({
      where: { workspace_id: workspaceId },
      order: [['created_at', 'DESC']],
    });
    for (const f of forms) f.fields = parseJsonField(f.fields);
    return forms;
  }

  async get(workspaceId: string, id: string) {
    const f = await this.models.LeadForm.findOne({ where: { id, workspace_id: workspaceId } });
    if (!f) throw new NotFoundError('Form not found');
    f.fields = parseJsonField(f.fields);
    return f;
  }

  /** Public lookup by slug — no workspace gate. */
  async getBySlug(slug: string) {
    const f = await this.models.LeadForm.findOne({ where: { slug } });
    if (!f || !f.is_active) throw new NotFoundError('Form not found');
    f.fields = parseJsonField(f.fields);
    return f;
  }

  async create(workspaceId: string, input: {
    name: string;
    description?: string;
    fields: FormFieldSpec[];
    on_submit_tags?: string[];
    on_submit_lifecycle?: 'subscriber' | 'lead' | 'mql';
    success_message?: string;
    slug?: string;
  }) {
    if (!input.name || input.name.trim().length < 2) {
      throw new ValidationError('Invalid name', { name: ['Required'] });
    }
    if (!Array.isArray(input.fields) || input.fields.length === 0) {
      throw new ValidationError('Form must have at least one field', { fields: ['Required'] });
    }
    for (const f of input.fields) {
      if (!f.name || !f.label || !VALID_FIELD_TYPES.includes(f.type)) {
        throw new ValidationError('Invalid field', {
          fields: [`Field ${JSON.stringify(f)} is invalid`],
        });
      }
    }
    // Email field is required for a lead-capture form
    if (!input.fields.find((f) => f.type === 'email')) {
      throw new ValidationError('Form must include an email field', {
        fields: ['At least one field must be type=email'],
      });
    }
    const slug = input.slug || this.makeSlug(input.name);
    return this.models.LeadForm.create({
      workspace_id: workspaceId,
      slug,
      name: input.name.trim(),
      description: input.description ?? null,
      fields: input.fields,
      on_submit_tags: input.on_submit_tags ?? null,
      on_submit_lifecycle: input.on_submit_lifecycle ?? 'lead',
      success_message: input.success_message ?? 'Thanks — we\'ll be in touch shortly.',
      is_active: true,
      submission_count: 0,
    } as any);
  }

  async remove(workspaceId: string, id: string) {
    const f = await this.get(workspaceId, id);
    await f.destroy();
    return { id, removed: true };
  }

  /**
   * Public submission handler. Validates the payload against the form's field spec,
   * upserts a Contact, increments submission_count.
   */
  async submit(slug: string, payload: Record<string, unknown>, ctx: { ip?: string; user_agent?: string }) {
    const form = await this.getBySlug(slug);
    const fields = parseJsonField(form.fields);

    // Validate against the form's spec
    const cleaned: Record<string, unknown> = {};
    for (const f of fields) {
      const value = payload[f.name];
      if (f.required && (value == null || value === '')) {
        throw new ValidationError('Validation failed', { [f.name]: ['Required'] });
      }
      if (value == null || value === '') continue;
      if (f.type === 'email' && typeof value === 'string' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
        throw new ValidationError('Validation failed', { [f.name]: ['Invalid email'] });
      }
      cleaned[f.name] = value;
    }

    const email = typeof cleaned.email === 'string' ? cleaned.email : undefined;
    const first_name = typeof cleaned.first_name === 'string' ? cleaned.first_name : undefined;
    const last_name = typeof cleaned.last_name === 'string' ? cleaned.last_name : undefined;
    const phone = typeof cleaned.phone === 'string' ? cleaned.phone : undefined;
    const company = typeof cleaned.company === 'string' ? cleaned.company : undefined;

    if (!email && !phone) {
      throw new BadRequestError('Form must collect an email or phone to identify the contact');
    }

    // Stash submission_id + raw payload + ctx in custom_fields for traceability
    const submission_id = crypto.randomBytes(8).toString('hex');
    const custom_fields: Record<string, unknown> = {
      ...cleaned,
      _last_form_submission: { form_id: form.id, submission_id, at: new Date().toISOString(), ip: ctx.ip, ua: ctx.user_agent },
    };

    const { contact, created } = await this.contactService.upsertFromForm(form.workspace_id, {
      email,
      first_name,
      last_name,
      phone,
      company,
      tags: form.on_submit_tags ?? undefined,
      lifecycle_stage: form.on_submit_lifecycle ?? undefined,
      source: `form:${form.slug}`,
      custom_fields,
    });

    await form.update({ submission_count: form.submission_count + 1 });

    return {
      submission_id,
      contact_id: contact.id,
      created,
      success_message: form.success_message,
    };
  }

  private makeSlug(name: string): string {
    const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
    const suffix = crypto.randomBytes(3).toString('hex');
    return `${base}-${suffix}`;
  }
}

/**
 * MySQL's `JSON` columns are returned as strings by mysql2 in some configurations
 * even when Sequelize is told the column is DataTypes.JSON. Parse defensively.
 */
function parseJsonField<T>(value: T | string): T {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  }
  return value;
}
