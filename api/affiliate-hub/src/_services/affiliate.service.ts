import type { Models } from '../models/index.js';
import {
  NotFoundError,
  ValidationError,
  BadRequestError,
} from '@marketing/shared-middleware';
import type { AffiliateStatus } from '../models/affiliate.model.js';

export class AffiliateService {
  constructor(private models: Models) {}

  async list(workspaceId: string, opts: { program_id?: string; status?: string }) {
    const where: any = { workspace_id: workspaceId };
    if (opts.program_id) where.program_id = opts.program_id;
    if (opts.status) where.status = opts.status;
    return this.models.Affiliate.findAll({
      where,
      order: [['created_at', 'DESC']],
      include: [{ model: this.models.AffiliateProgram, as: 'program' }],
    });
  }

  async get(workspaceId: string, id: string) {
    const a = await this.models.Affiliate.findOne({
      where: { id, workspace_id: workspaceId },
      include: [{ model: this.models.AffiliateProgram, as: 'program' }],
    });
    if (!a) throw new NotFoundError('Affiliate not found');
    return a;
  }

  async apply(workspaceId: string, input: {
    program_id: string;
    email: string;
    full_name?: string;
    payout_method?: string;
    payout_details?: Record<string, unknown>;
  }) {
    if (!input.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.email)) {
      throw new ValidationError('Invalid email', { email: ['Required'] });
    }
    const program = await this.models.AffiliateProgram.findOne({
      where: { id: input.program_id, workspace_id: workspaceId },
    });
    if (!program) throw new NotFoundError('Program not found');
    if (program.status !== 'active' && program.status !== 'draft') {
      throw new BadRequestError(`Program is ${program.status} — not accepting applications`);
    }
    const existing = await this.models.Affiliate.findOne({
      where: { program_id: program.id, email: input.email.toLowerCase() },
    });
    if (existing) {
      return existing;
    }
    return this.models.Affiliate.create({
      workspace_id: workspaceId,
      program_id: program.id,
      email: input.email.toLowerCase().trim(),
      full_name: input.full_name ?? null,
      payout_method: input.payout_method ?? null,
      payout_details: input.payout_details ?? null,
      status: 'pending',
    } as any);
  }

  async updateStatus(workspaceId: string, id: string, status: AffiliateStatus) {
    const a = await this.get(workspaceId, id);
    const update: Record<string, unknown> = { status };
    if (status === 'approved' && !a.approved_at) update.approved_at = new Date();
    await a.update(update);
    return a;
  }

  async remove(workspaceId: string, id: string) {
    const a = await this.get(workspaceId, id);
    await a.destroy();
    return { id, removed: true };
  }
}
