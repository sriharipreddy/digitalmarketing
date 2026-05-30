import type { Models } from '../models/index.js';
import { NotFoundError, ValidationError } from '@marketing/shared-middleware';

export class GoalService {
  constructor(private models: Models) {}

  async list(workspaceId: string) {
    const rows = await this.models.ConversionGoal.findAll({
      where: { workspace_id: workspaceId },
      order: [['created_at', 'DESC']],
    });
    for (const r of rows) r.property_filters = parseJsonField(r.property_filters);
    return rows;
  }

  async create(
    workspaceId: string,
    userId: string,
    input: {
      name: string;
      description?: string;
      event_name: string;
      property_filters?: Record<string, string>;
      value_usd?: number;
    },
  ) {
    if (!input.name || input.name.trim().length < 2) {
      throw new ValidationError('Validation failed', { name: ['Required'] });
    }
    if (!input.event_name || input.event_name.trim().length === 0) {
      throw new ValidationError('Validation failed', { event_name: ['Required'] });
    }
    return this.models.ConversionGoal.create({
      workspace_id: workspaceId,
      name: input.name.trim(),
      description: input.description ?? null,
      event_name: input.event_name.trim(),
      property_filters: input.property_filters ?? null,
      value_usd: input.value_usd ?? 0,
      is_active: true,
      created_by: userId,
    } as any);
  }

  async remove(workspaceId: string, id: string) {
    const g = await this.models.ConversionGoal.findOne({
      where: { id, workspace_id: workspaceId },
    });
    if (!g) throw new NotFoundError('Goal not found');
    await g.destroy();
    return { id, removed: true };
  }
}

function parseJsonField<T>(value: T | string | null): T | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  }
  return value;
}
