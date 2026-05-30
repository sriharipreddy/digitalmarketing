import type { Models } from '../models/index.js';
import type { ImageDriver, ImageGenerateInput } from './image.driver.js';
import { ValidationError, NotFoundError } from '@marketing/shared-middleware';

export class ImageService {
  constructor(
    private models: Models,
    private driver: ImageDriver,
    private defaultModel: string,
  ) {}

  async generate(
    workspaceId: string,
    userId: string,
    input: { prompt: string; size?: ImageGenerateInput['size']; style?: 'natural' | 'vivid'; model?: string },
  ) {
    if (!input.prompt || input.prompt.trim().length < 4) {
      throw new ValidationError('Prompt too short', { prompt: ['Must be at least 4 characters'] });
    }
    const model = input.model ?? this.defaultModel;
    const size = input.size ?? '1024x1024';
    const result = await this.driver.generate({
      prompt: input.prompt.trim(),
      model,
      size,
      style: input.style,
    });
    const row = await this.models.ImageGeneration.create({
      workspace_id: workspaceId,
      user_id: userId,
      prompt: input.prompt.trim(),
      model: result.model,
      size,
      style: input.style ?? null,
      image_url: result.image_url,
      revised_prompt: result.revised_prompt,
      cost_usd: result.cost_usd,
    } as any);
    return row;
  }

  async list(workspaceId: string, opts: { limit?: number; offset?: number }) {
    const { rows, count } = await this.models.ImageGeneration.findAndCountAll({
      where: { workspace_id: workspaceId },
      order: [['created_at', 'DESC']],
      limit: Math.min(opts.limit ?? 25, 100),
      offset: opts.offset ?? 0,
    });
    return { rows, total: count };
  }

  async remove(workspaceId: string, id: string) {
    const row = await this.models.ImageGeneration.findOne({
      where: { id, workspace_id: workspaceId },
    });
    if (!row) throw new NotFoundError('Image not found');
    await row.destroy();
    return { id, removed: true };
  }
}
