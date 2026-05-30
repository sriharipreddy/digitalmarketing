export interface TranscribeInput {
  audio_url: string;
  model: string;
  language?: string;
}

export interface TranscribeResult {
  transcript: string;
  language: string;
  duration_seconds: number | null;
  cost_usd: number;
  model: string;
}

export interface TranscriptDriver {
  transcribe(input: TranscribeInput): Promise<TranscribeResult>;
}

// Whisper-1 pricing: $0.006 per minute of audio.
const WHISPER_PER_MINUTE = 0.006;

export class RealWhisperDriver implements TranscriptDriver {
  constructor(private apiKey: string) {}

  async transcribe(input: TranscribeInput): Promise<TranscribeResult> {
    // OpenAI Whisper accepts multipart form data. For a URL-based input we
    // download then re-upload. Big audio files belong in a Bull queue in prod;
    // here we keep it inline.
    const audioRes = await fetch(input.audio_url);
    if (!audioRes.ok) throw new Error(`Failed to fetch audio: ${audioRes.status}`);
    const audioBuf = Buffer.from(await audioRes.arrayBuffer());

    const form = new FormData();
    form.append('file', new Blob([audioBuf]), 'audio.mp3');
    form.append('model', input.model);
    if (input.language) form.append('language', input.language);
    form.append('response_format', 'verbose_json');

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: form,
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Whisper ${res.status}: ${body.slice(0, 400)}`);
    }
    const data: any = await res.json();
    const duration = Number(data.duration ?? 0);
    return {
      transcript: data.text ?? '',
      language: data.language ?? input.language ?? 'en',
      duration_seconds: duration || null,
      cost_usd: duration ? Math.round((duration / 60) * WHISPER_PER_MINUTE * 10000) / 10000 : 0,
      model: input.model,
    };
  }
}

export class StubTranscriptDriver implements TranscriptDriver {
  async transcribe(input: TranscribeInput): Promise<TranscribeResult> {
    return {
      transcript: `[stub transcript] This is a placeholder transcript for ${input.audio_url}. Drop OPENAI_API_KEY into api/media-hub/.env and set AI_DRIVER=openai to run real Whisper transcription.`,
      language: input.language ?? 'en',
      duration_seconds: 120,
      cost_usd: 0,
      model: `stub:${input.model}`,
    };
  }
}
