import type { Models } from '../models/index.js';
import { NotFoundError, ValidationError } from '@marketing/shared-middleware';
import type { ProgramStatus } from '../models/program.model.js';

export class ProgramService {
  constructor(private models: Models) {}

  async list(workspaceId: string) {
    return this.models.AffiliateProgram.findAll({
      where: { workspace_id: workspaceId },
      order: [['created_at', 'DESC']],
    });
  }

  async get(workspaceId: string, id: string) {
    const p = await this.models.AffiliateProgram.findOne({
      where: { id, workspace_id: workspaceId },
    });
    if (!p) throw new NotFoundError('Program not found');
    return p;
  }

  async create(workspaceId: string, userId: string, input: {
    name: string;
    description?: string;
    commission_kind?: 'percent' | 'fixed_usd';
    commission_value?: number;
    attribution?: 'first_click' | 'last_click';
    cookie_days?: number;
    terms_url?: string;
  }) {
    if (!input.name || input.name.trim().length < 2) {
      throw new ValidationError('Invalid name', { name: ['Required'] });
    }
    if (input.commission_value != null && input.commission_value < 0) {
      throw new ValidationError('Invalid commission', { commission_value: ['Must be >= 0'] });
    }
    return this.models.AffiliateProgram.create({
      workspace_id: workspaceId,
      name: input.name.trim(),
      description: input.description ?? null,
      commission_kind: input.commission_kind ?? 'percent',
      commission_value: input.commission_value ?? 10,
      attribution: input.attribution ?? 'last_click',
      cookie_days: input.cookie_days ?? 30,
      status: 'draft',
      terms_url: input.terms_url ?? null,
      created_by: userId,
    } as any);
  }

  async update(workspaceId: string, id: string, patch: { status?: ProgramStatus; commission_value?: number; cookie_days?: number; description?: string }) {
    const p = await this.get(workspaceId, id);
    const update: Record<string, unknown> = {};
    if (patch.status !== undefined) update.status = patch.status;
    if (patch.commission_value !== undefined) update.commission_value = patch.commission_value;
    if (patch.cookie_days !== undefined) update.cookie_days = patch.cookie_days;
    if (patch.description !== undefined) update.description = patch.description;
    await p.update(update);
    return p;
  }

  async remove(workspaceId: string, id: string) {
    const p = await this.get(workspaceId, id);
    await p.destroy();
    return { id, removed: true };
  }
}
