import type { Models } from '../models/index.js';
import type { OpenAIDriver } from './openai.driver.js';
import type { TokenCapService } from './token-cap.service.js';
import { ValidationError } from '@marketing/shared-middleware';

const KIND_SYSTEM_PROMPTS: Record<string, string> = {
  blog: 'You are a skilled SEO blog writer. Output well-structured Markdown with an H1, intro, 3-5 sections with H2/H3 headings, and a concise conclusion. Include meta-friendly keywords organically.',
  social: 'You are a senior social media copywriter. Output 3 distinct post variations (each <280 chars unless platform allows more), no hashtags unless asked, and a brief reasoning line per variation.',
  email: 'You are a B2B email marketer. Output: Subject line (<70 chars), Preheader (<100 chars), Body (HTML-compatible plain text under 200 words), CTA text. Use the tone consistently.',
  ad_copy: 'You are a performance marketer. Output 3 ad variations for the requested platform: Headline (<30 chars), Description (<90 chars), and a one-line value proposition. Comply with the platform\'s character limits.',
  headline: 'You are a copywriter. Output 8 distinct headline variations: punchy, benefit-led, and varied in tone. One per line, no commentary.',
};

export interface GenerateOptions {
  kind: keyof typeof KIND_SYSTEM_PROMPTS;
  prompt: string;
  brand_voice_id?: string;
  model?: string;
  max_tokens?: number;
  temperature?: number;
}

export class GenerationService {
  constructor(
    private models: Models,
    private openaiDriver: OpenAIDriver,
    private tokenCapService: TokenCapService,
    private defaultModel: string,
  ) {}

  async generate(workspaceId: string, userId: string, opts: GenerateOptions) {
    if (!KIND_SYSTEM_PROMPTS[opts.kind]) {
      throw new ValidationError('Invalid kind', {
        kind: [`Must be one of: ${Object.keys(KIND_SYSTEM_PROMPTS).join(', ')}`],
      });
    }
    if (!opts.prompt || opts.prompt.trim().length < 4) {
      throw new ValidationError('Prompt too short', { prompt: ['Must be at least 4 characters'] });
    }

    // 1. Token-cap pre-check
    const cap = await this.tokenCapService.assertWithinDailyCap(workspaceId);

    // 2. Build the system prompt, optionally with brand voice
    let system = KIND_SYSTEM_PROMPTS[opts.kind]!;
    if (opts.brand_voice_id) {
      const voice = await this.models.BrandVoice.findOne({
        where: { id: opts.brand_voice_id, workspace_id: workspaceId },
      });
      if (voice) {
        system += `\n\nBrand voice: ${voice.name}. Tone: ${voice.tone}.`;
        if (voice.style) system += ` Style: ${voice.style}.`;
        if (voice.description) system += ` Notes: ${voice.description}.`;
        if (voice.sample_text) system += `\n\nExample of this voice:\n${voice.sample_text}`;
      }
    }

    // 3. Call the driver
    const model = opts.model ?? this.defaultModel;
    const result = await this.openaiDriver.generate({
      system_prompt: system,
      user_prompt: opts.prompt,
      model,
      max_tokens: opts.max_tokens,
      temperature: opts.temperature,
    });

    // 4. Persist
    const row = await this.models.Generation.create({
      workspace_id: workspaceId,
      user_id: userId,
      kind: opts.kind,
      brand_voice_id: opts.brand_voice_id ?? null,
      prompt: opts.prompt,
      model: result.model,
      output: result.output,
      prompt_tokens: result.prompt_tokens,
      completion_tokens: result.completion_tokens,
      total_tokens: result.total_tokens,
      cost_usd: result.cost_usd,
    } as any);

    return {
      generation: row,
      quota: { ...cap, used_after: cap.used + result.total_tokens },
    };
  }

  async listRecent(workspaceId: string, opts: { limit?: number; offset?: number }) {
    const { rows, count } = await this.models.Generation.findAndCountAll({
      where: { workspace_id: workspaceId },
      order: [['created_at', 'DESC']],
      limit: Math.min(opts.limit ?? 25, 100),
      offset: opts.offset ?? 0,
    });
    return { rows, total: count };
  }
}
