import { api } from './api';

export interface BrandVoice {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  tone: string;
  style: string | null;
  sample_text: string | null;
  created_at: string;
}

export type ContentKind = 'blog' | 'social' | 'email' | 'ad_copy' | 'headline' | 'landing_page' | 'press_release';
export type ContentStatus = 'draft' | 'in_review' | 'scheduled' | 'published' | 'archived';

export interface Generation {
  id: string;
  kind: ContentKind;
  output: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
  created_at: string;
}

export interface ContentPiece {
  id: string;
  workspace_id: string;
  kind: ContentKind;
  title: string;
  body: string;
  brand_voice_id: string | null;
  source_generation_id: string | null;
  language: string;
  status: ContentStatus;
  scheduled_at: string | null;
  published_at: string | null;
  tags: string[] | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface QuotaInfo {
  plan_slug: string;
  used: number;
  used_after: number;
  cap: number;
}

export const contentApi = {
  listVoices: (workspaceId: string) =>
    api.get<{ data: { voices: BrandVoice[] } }>(`/content/workspaces/${workspaceId}/brand-voices`),
  createVoice: (
    workspaceId: string,
    body: { name: string; description?: string; tone?: string; style?: string; sample_text?: string },
  ) =>
    api.post<{ data: { voice: BrandVoice } }>(
      `/content/workspaces/${workspaceId}/brand-voices`,
      body,
    ),
  removeVoice: (workspaceId: string, voiceId: string) =>
    api.delete<{ data: { id: string; removed: boolean } }>(
      `/content/workspaces/${workspaceId}/brand-voices/${voiceId}`,
    ),

  generate: (
    workspaceId: string,
    body: {
      kind: ContentKind;
      prompt: string;
      brand_voice_id?: string;
      max_tokens?: number;
      temperature?: number;
    },
  ) =>
    api.post<{ data: { generation: Generation; quota: QuotaInfo } }>(
      `/content/workspaces/${workspaceId}/generate`,
      body,
    ),
  listGenerations: (workspaceId: string, opts?: { limit?: number; offset?: number }) =>
    api.get<{ data: { rows: Generation[]; total: number } }>(
      `/content/workspaces/${workspaceId}/generations`,
      { params: opts },
    ),

  // Content pieces (saved + scheduled)
  listPieces: (workspaceId: string, opts?: { status?: string; kind?: string; limit?: number }) =>
    api.get<{ data: { rows: ContentPiece[]; total: number } }>(
      `/content/workspaces/${workspaceId}/pieces`,
      { params: opts },
    ),
  createPiece: (
    workspaceId: string,
    body: { kind: ContentKind; title: string; body: string; brand_voice_id?: string; language?: string; tags?: string[] },
  ) =>
    api.post<{ data: { piece: ContentPiece } }>(`/content/workspaces/${workspaceId}/pieces`, body),
  savePieceFromGeneration: (workspaceId: string, generation_id: string, title?: string) =>
    api.post<{ data: { piece: ContentPiece } }>(
      `/content/workspaces/${workspaceId}/pieces/from-generation`,
      { generation_id, title },
    ),
  updatePiece: (
    workspaceId: string,
    pieceId: string,
    patch: { title?: string; body?: string; status?: ContentStatus; scheduled_at?: string | null; tags?: string[] },
  ) =>
    api.patch<{ data: { piece: ContentPiece } }>(
      `/content/workspaces/${workspaceId}/pieces/${pieceId}`,
      patch,
    ),
  translatePiece: (workspaceId: string, pieceId: string, target_language: string) =>
    api.post<{ data: { piece: ContentPiece } }>(
      `/content/workspaces/${workspaceId}/pieces/${pieceId}/translate`,
      { target_language },
    ),
  removePiece: (workspaceId: string, pieceId: string) =>
    api.delete<{ data: { id: string; removed: boolean } }>(
      `/content/workspaces/${workspaceId}/pieces/${pieceId}`,
    ),
};
