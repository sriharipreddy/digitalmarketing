import type { Models } from '../models/index.js';
import type { OpenAIDriver } from './openai.driver.js';
import type { TokenCapService } from './token-cap.service.js';
import {
  NotFoundError,
  ValidationError,
  BadRequestError,
} from '@marketing/shared-middleware';
import type { ContentKind, ContentStatus } from '../models/content-piece.model.js';

const VALID_STATUS: ContentStatus[] = ['draft', 'in_review', 'scheduled', 'published', 'archived'];

export class ContentPieceService {
  constructor(
    private models: Models,
    private openaiDriver: OpenAIDriver,
    private tokenCapService: TokenCapService,
    private defaultModel: string,
  ) {}

  async list(workspaceId: string, opts: { limit?: number; offset?: number; status?: string; kind?: string }) {
    const where: any = { workspace_id: workspaceId };
    if (opts.status) where.status = opts.status;
    if (opts.kind) where.kind = opts.kind;
    const { rows, count } = await this.models.ContentPiece.findAndCountAll({
      where,
      order: [['updated_at', 'DESC']],
      limit: Math.min(opts.limit ?? 50, 200),
      offset: opts.offset ?? 0,
    });
    return { rows: rows.map((r) => this.publicPiece(r)), total: count };
  }

  async get(workspaceId: string, id: string) {
    const p = await this.models.ContentPiece.findOne({ where: { id, workspace_id: workspaceId } });
    if (!p) throw new NotFoundError('Content piece not found');
    return p;
  }

  async create(
    workspaceId: string,
    userId: string,
    input: {
      kind: ContentKind;
      title: string;
      body: string;
      brand_voice_id?: string;
      source_generation_id?: string;
      language?: string;
      tags?: string[];
    },
  ) {
    if (!input.title || input.title.trim().length < 2) {
      throw new ValidationError('Invalid title', { title: ['Required'] });
    }
    return this.models.ContentPiece.create({
      workspace_id: workspaceId,
      kind: input.kind,
      title: input.title.trim(),
      body: input.body,
      brand_voice_id: input.brand_voice_id ?? null,
      source_generation_id: input.source_generation_id ?? null,
      language: input.language ?? 'en',
      status: 'draft',
      tags: input.tags ?? null,
      created_by: userId,
    } as any);
  }

  /** Create a content piece from a prior Generation row (saves the AI output). */
  async createFromGeneration(workspaceId: string, userId: string, generationId: string, title?: string) {
    const gen = await this.models.Generation.findOne({
      where: { id: generationId, workspace_id: workspaceId },
    });
    if (!gen) throw new NotFoundError('Generation not found');
    return this.models.ContentPiece.create({
      workspace_id: workspaceId,
      kind: gen.kind,
      title: title ?? `${gen.kind} — ${new Date().toLocaleDateString()}`,
      body: gen.output,
      brand_voice_id: gen.brand_voice_id,
      source_generation_id: gen.id,
      language: 'en',
      status: 'draft',
      created_by: userId,
    } as any);
  }

  async update(
    workspaceId: string,
    id: string,
    patch: {
      title?: string;
      body?: string;
      status?: ContentStatus;
      scheduled_at?: Date | null;
      tags?: string[];
    },
  ) {
    const p = await this.get(workspaceId, id);
    if (patch.status && !VALID_STATUS.includes(patch.status)) {
      throw new ValidationError('Invalid status', { status: [`Must be one of: ${VALID_STATUS.join(', ')}`] });
    }
    if (patch.status === 'scheduled' && !patch.scheduled_at && !p.scheduled_at) {
      throw new BadRequestError('Set scheduled_at when status=scheduled');
    }
    const update: Record<string, unknown> = {};
    if (patch.title !== undefined) update.title = patch.title.trim();
    if (patch.body !== undefined) update.body = patch.body;
    if (patch.status !== undefined) {
      update.status = patch.status;
      if (patch.status === 'published') update.published_at = new Date();
    }
    if (patch.scheduled_at !== undefined) update.scheduled_at = patch.scheduled_at;
    if (patch.tags !== undefined) update.tags = patch.tags;
    await p.update(update);
    return p;
  }

  async remove(workspaceId: string, id: string) {
    const p = await this.get(workspaceId, id);
    await p.destroy();
    return { id, removed: true };
  }

  /** Translate a content piece into a target language using the AI driver. */
  async translate(workspaceId: string, userId: string, id: string, target_language: string) {
    const piece = await this.get(workspaceId, id);
    if (target_language === piece.language) {
      throw new BadRequestError(`Piece is already in ${target_language}`);
    }
    await this.tokenCapService.assertWithinDailyCap(workspaceId);
    const result = await this.openaiDriver.generate({
      system_prompt: `You are a professional translator. Translate the user's text into ${target_language}. Preserve formatting (Markdown, line breaks, lists). Do not add commentary. Return only the translated text.`,
      user_prompt: piece.body,
      model: this.defaultModel,
      max_tokens: 4000,
      temperature: 0.2,
    });

    // Persist translation as a new piece linked to the original
    const translated = await this.models.ContentPiece.create({
      workspace_id: workspaceId,
      kind: piece.kind,
      title: `${piece.title} [${target_language}]`,
      body: result.output,
      brand_voice_id: piece.brand_voice_id,
      source_generation_id: piece.source_generation_id,
      language: target_language,
      status: 'draft',
      tags: piece.tags as any,
      metadata: { translated_from: piece.id },
      created_by: userId,
    } as any);

    // Persist a generation row for accounting
    await this.models.Generation.create({
      workspace_id: workspaceId,
      user_id: userId,
      kind: piece.kind,
      brand_voice_id: piece.brand_voice_id,
      prompt: `[translate to ${target_language}] ${piece.body.slice(0, 200)}`,
      model: result.model,
      output: result.output,
      prompt_tokens: result.prompt_tokens,
      completion_tokens: result.completion_tokens,
      total_tokens: result.total_tokens,
      cost_usd: result.cost_usd,
    } as any);

    return translated;
  }

  publicPiece(p: any) {
    return {
      id: p.id,
      workspace_id: p.workspace_id,
      kind: p.kind,
      title: p.title,
      body: p.body,
      brand_voice_id: p.brand_voice_id,
      source_generation_id: p.source_generation_id,
      language: p.language,
      status: p.status,
      scheduled_at: p.scheduled_at,
      published_at: p.published_at,
      tags: parseJsonField(p.tags),
      metadata: parseJsonField(p.metadata),
      created_at: p.created_at,
      updated_at: p.updated_at,
    };
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
