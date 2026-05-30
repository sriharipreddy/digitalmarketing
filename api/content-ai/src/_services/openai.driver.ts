export interface GenerateInput {
  system_prompt: string;
  user_prompt: string;
  model: string;
  max_tokens?: number;
  temperature?: number;
}

export interface GenerateResult {
  output: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
  model: string;
}

export interface OpenAIDriver {
  generate(input: GenerateInput): Promise<GenerateResult>;
}

// Rough public per-1K-token prices (USD) — keep up to date.
// https://openai.com/api/pricing
const PRICING: Record<string, { in: number; out: number }> = {
  'gpt-4o': { in: 0.005, out: 0.015 },
  'gpt-4o-mini': { in: 0.00015, out: 0.0006 },
  'gpt-4-turbo': { in: 0.01, out: 0.03 },
};

function costForUsage(model: string, prompt: number, completion: number): number {
  const p = PRICING[model] ?? PRICING['gpt-4o-mini']!;
  return Math.round(((prompt / 1000) * p.in + (completion / 1000) * p.out) * 10000) / 10000;
}

export class RealOpenAIDriver implements OpenAIDriver {
  constructor(private apiKey: string) {}

  async generate(input: GenerateInput): Promise<GenerateResult> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: input.model,
        messages: [
          { role: 'system', content: input.system_prompt },
          { role: 'user', content: input.user_prompt },
        ],
        max_tokens: input.max_tokens ?? 1024,
        temperature: input.temperature ?? 0.7,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OpenAI ${res.status}: ${body.slice(0, 400)}`);
    }
    const data: any = await res.json();
    const choice = data.choices?.[0]?.message?.content ?? '';
    const u = data.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    return {
      output: choice,
      prompt_tokens: u.prompt_tokens,
      completion_tokens: u.completion_tokens,
      total_tokens: u.total_tokens,
      cost_usd: costForUsage(input.model, u.prompt_tokens, u.completion_tokens),
      model: data.model ?? input.model,
    };
  }
}

/** Deterministic stub for dev without an OpenAI key. */
export class StubOpenAIDriver implements OpenAIDriver {
  async generate(input: GenerateInput): Promise<GenerateResult> {
    const output = `[stub generation]\n\nSystem: ${input.system_prompt.slice(0, 120)}…\n\nUser prompt: ${input.user_prompt.slice(0, 240)}\n\nThis is a deterministic placeholder response from the stub OpenAI driver. Drop a real OPENAI_API_KEY in .env and set AI_DRIVER=openai to enable live generation.`;
    const prompt_tokens = Math.ceil((input.system_prompt.length + input.user_prompt.length) / 4);
    const completion_tokens = Math.ceil(output.length / 4);
    return {
      output,
      prompt_tokens,
      completion_tokens,
      total_tokens: prompt_tokens + completion_tokens,
      cost_usd: 0,
      model: `stub:${input.model}`,
    };
  }
}
