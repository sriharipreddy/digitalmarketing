import { api } from './api';

export interface ImageGeneration {
  id: string;
  workspace_id: string;
  user_id: string;
  prompt: string;
  model: string;
  size: string;
  style: string | null;
  image_url: string;
  revised_prompt: string | null;
  cost_usd: number;
  created_at: string;
}

export interface Video {
  id: string;
  workspace_id: string;
  source: 'youtube' | 'tiktok' | 'instagram_reel' | 'upload';
  external_id: string | null;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  view_count: number | null;
  published_at: string | null;
  audio_url: string | null;
  transcript: string | null;
  transcript_language: string | null;
  status: 'imported' | 'transcribing' | 'transcribed' | 'failed';
  error: string | null;
  created_at: string;
}

export const mediaApi = {
  listImages: (workspaceId: string, opts?: { limit?: number; offset?: number }) =>
    api.get<{ data: { rows: ImageGeneration[]; total: number } }>(
      `/media/workspaces/${workspaceId}/images`,
      { params: opts },
    ),
  generateImage: (
    workspaceId: string,
    body: { prompt: string; size?: string; style?: 'natural' | 'vivid' },
  ) =>
    api.post<{ data: { image: ImageGeneration } }>(
      `/media/workspaces/${workspaceId}/images/generate`,
      body,
    ),
  removeImage: (workspaceId: string, imageId: string) =>
    api.delete<{ data: { id: string; removed: boolean } }>(
      `/media/workspaces/${workspaceId}/images/${imageId}`,
    ),

  listVideos: (workspaceId: string, opts?: { limit?: number; source?: string }) =>
    api.get<{ data: { rows: Video[]; total: number } }>(
      `/media/workspaces/${workspaceId}/videos`,
      { params: opts },
    ),
  importYouTube: (workspaceId: string, url: string) =>
    api.post<{ data: { video: Video } }>(
      `/media/workspaces/${workspaceId}/videos/import/youtube`,
      { url },
    ),
  transcribe: (workspaceId: string, videoId: string, audio_url?: string) =>
    api.post<{ data: { video: Video } }>(
      `/media/workspaces/${workspaceId}/videos/${videoId}/transcribe`,
      audio_url ? { audio_url } : {},
    ),
  removeVideo: (workspaceId: string, videoId: string) =>
    api.delete<{ data: { id: string; removed: boolean } }>(
      `/media/workspaces/${workspaceId}/videos/${videoId}`,
    ),
};
