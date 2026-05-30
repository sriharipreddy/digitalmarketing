import type { Models } from '../models/index.js';
import { NotFoundError, ValidationError } from '@marketing/shared-middleware';

export class BrandVoiceService {
  constructor(private models: Models) {}

  async list(workspaceId: string) {
    return this.models.BrandVoice.findAll({
      where: { workspace_id: workspaceId },
      order: [['created_at', 'DESC']],
    });
  }

  async create(workspaceId: string, input: {
    name: string;
    description?: string;
    tone?: string;
    style?: string;
    sample_text?: string;
  }) {
    if (!input.name || input.name.trim().length < 2) {
      throw new ValidationError('Invalid name', { name: ['Must be at least 2 characters'] });
    }
    return this.models.BrandVoice.create({
      workspace_id: workspaceId,
      name: input.name.trim(),
      description: input.description ?? null,
      tone: input.tone ?? 'professional',
      style: input.style ?? null,
      sample_text: input.sample_text ?? null,
    } as any);
  }

  async get(workspaceId: string, id: string) {
    const v = await this.models.BrandVoice.findOne({ where: { id, workspace_id: workspaceId } });
    if (!v) throw new NotFoundError('Brand voice not found');
    return v;
  }

  async remove(workspaceId: string, id: string) {
    const v = await this.get(workspaceId, id);
    await v.destroy();
    return { id, removed: true };
  }
}
