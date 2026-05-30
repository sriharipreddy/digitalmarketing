export interface ImageGenerateInput {
  prompt: string;
  model: string;
  size: '1024x1024' | '1792x1024' | '1024x1792';
  style?: 'natural' | 'vivid';
  n?: number;
}

export interface ImageGenerateResult {
  image_url: string;
  revised_prompt: string | null;
  cost_usd: number;
  model: string;
}

export interface ImageDriver {
  generate(input: ImageGenerateInput): Promise<ImageGenerateResult>;
}

// Rough public pricing per image (USD). Update as OpenAI changes prices.
const IMAGE_PRICING: Record<string, Record<string, number>> = {
  'dall-e-3': {
    '1024x1024': 0.04,
    '1792x1024': 0.08,
    '1024x1792': 0.08,
  },
  'dall-e-2': {
    '1024x1024': 0.02,
    '512x512': 0.018,
    '256x256': 0.016,
  },
};

function priceFor(model: string, size: string): number {
  return IMAGE_PRICING[model]?.[size] ?? 0.04;
}

export class RealOpenAIImageDriver implements ImageDriver {
  constructor(private apiKey: string) {}

  async generate(input: ImageGenerateInput): Promise<ImageGenerateResult> {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: input.model,
        prompt: input.prompt,
        size: input.size,
        style: input.style ?? 'vivid',
        n: input.n ?? 1,
        response_format: 'url',
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OpenAI image ${res.status}: ${body.slice(0, 400)}`);
    }
    const data: any = await res.json();
    const first = data.data?.[0];
    return {
      image_url: first?.url ?? '',
      revised_prompt: first?.revised_prompt ?? null,
      cost_usd: priceFor(input.model, input.size),
      model: input.model,
    };
  }
}

export class StubImageDriver implements ImageDriver {
  async generate(input: ImageGenerateInput): Promise<ImageGenerateResult> {
    // Return a placeholder image URL that any browser can render. We hash the
    // prompt to a unique placeholder so the UI shows different images per call.
    const seed = simpleHash(input.prompt);
    const [w, h] = input.size.split('x').map((n) => parseInt(n, 10));
    return {
      image_url: `https://picsum.photos/seed/${seed}/${w}/${h}`,
      revised_prompt: `[stub] ${input.prompt.slice(0, 200)}`,
      cost_usd: 0,
      model: `stub:${input.model}`,
    };
  }
}

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}
