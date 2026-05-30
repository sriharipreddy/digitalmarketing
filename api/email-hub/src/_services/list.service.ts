import type { Models } from '../models/index.js';
import type { AudienceService, AudienceFilter } from './audience.service.js';
import { NotFoundError, ValidationError } from '@marketing/shared-middleware';

export class ListService {
  constructor(
    private models: Models,
    private audienceService: AudienceService,
  ) {}

  async list(workspaceId: string) {
    const rows = await this.models.EmailList.findAll({
      where: { workspace_id: workspaceId },
      order: [['created_at', 'DESC']],
    });
    for (const r of rows) r.filter = parseJsonField(r.filter) as any;
    return rows;
  }

  async get(workspaceId: string, id: string) {
    const list = await this.models.EmailList.findOne({ where: { id, workspace_id: workspaceId } });
    if (!list) throw new NotFoundError('List not found');
    list.filter = parseJsonField(list.filter) as any;
    return list;
  }

  async create(workspaceId: string, userId: string, input: {
    name: string;
    description?: string;
    filter: AudienceFilter;
  }) {
    if (!input.name || input.name.trim().length < 2) {
      throw new ValidationError('Invalid name', { name: ['Required'] });
    }
    if (!input.filter || typeof input.filter !== 'object') {
      throw new ValidationError('Invalid filter', { filter: ['Required object'] });
    }
    return this.models.EmailList.create({
      workspace_id: workspaceId,
      name: input.name.trim(),
      description: input.description ?? null,
      filter: input.filter,
      created_by: userId,
    } as any);
  }

  async preview(workspaceId: string, id: string) {
    const list = await this.get(workspaceId, id);
    const emails = await this.audienceService.resolve(workspaceId, list.filter);
    return { size: emails.length, sample: emails.slice(0, 5) };
  }

  async previewFilter(workspaceId: string, filter: AudienceFilter) {
    const emails = await this.audienceService.resolve(workspaceId, filter);
    return { size: emails.length, sample: emails.slice(0, 5) };
  }

  async remove(workspaceId: string, id: string) {
    const list = await this.get(workspaceId, id);
    await list.destroy();
    return { id, removed: true };
  }
}

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
