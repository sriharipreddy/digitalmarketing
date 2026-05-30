import { commonEnv, cleanEnv, str } from '@marketing/shared-config';

const serviceEnv = cleanEnv(process.env, {
  CORS_ORIGINS: str({ default: 'http://localhost:3000,http://localhost:5173' }),

  // OpenAI handles both DALL-E (images) and Whisper (transcription).
  AI_DRIVER: str({ choices: ['openai', 'stub'], default: 'stub' }),
  OPENAI_API_KEY: str({ default: '' }),
  IMAGE_MODEL_DEFAULT: str({ default: 'dall-e-3' }),
  WHISPER_MODEL_DEFAULT: str({ default: 'whisper-1' }),

  // Stability AI fallback for image generation
  STABILITY_API_KEY: str({ default: '' }),

  // YouTube Data API
  YOUTUBE_API_KEY: str({ default: '' }),

  SERVICE_NAME_SELF: str({ default: 'media-hub' }),
});

export const env = {
  ...commonEnv,
  ...serviceEnv,
  CORS_ORIGINS_LIST: serviceEnv.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
};
