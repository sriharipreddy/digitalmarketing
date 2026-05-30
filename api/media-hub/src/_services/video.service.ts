import type { Models } from '../models/index.js';
import type { YouTubeDriver } from './youtube.driver.js';
import type { TranscriptDriver } from './transcript.driver.js';
import {
  NotFoundError,
  ValidationError,
  BadRequestError,
} from '@marketing/shared-middleware';

export class VideoService {
  constructor(
    private models: Models,
    private youtubeDriver: YouTubeDriver,
    private transcriptDriver: TranscriptDriver,
    private whisperModel: string,
  ) {}

  async list(workspaceId: string, opts: { limit?: number; offset?: number; source?: string }) {
    const where: any = { workspace_id: workspaceId };
    if (opts.source) where.source = opts.source;
    const { rows, count } = await this.models.Video.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: Math.min(opts.limit ?? 25, 100),
      offset: opts.offset ?? 0,
    });
    return { rows, total: count };
  }

  async get(workspaceId: string, id: string) {
    const video = await this.models.Video.findOne({ where: { id, workspace_id: workspaceId } });
    if (!video) throw new NotFoundError('Video not found');
    return video;
  }

  async importYouTube(workspaceId: string, userId: string, urlOrId: string) {
    if (!urlOrId || urlOrId.trim().length === 0) {
      throw new ValidationError('Video URL or ID required', { url: ['Required'] });
    }
    const meta = await this.youtubeDriver.fetchMetadata(urlOrId.trim());

    const existing = await this.models.Video.findOne({
      where: { workspace_id: workspaceId, source: 'youtube', external_id: meta.external_id },
    });
    if (existing) {
      await existing.update({
        title: meta.title,
        description: meta.description,
        thumbnail_url: meta.thumbnail_url,
        duration_seconds: meta.duration_seconds,
        view_count: meta.view_count,
        published_at: meta.published_at,
        metadata: { channel_title: meta.channel_title },
      });
      return existing;
    }

    return this.models.Video.create({
      workspace_id: workspaceId,
      source: 'youtube',
      external_id: meta.external_id,
      title: meta.title,
      description: meta.description,
      thumbnail_url: meta.thumbnail_url,
      duration_seconds: meta.duration_seconds,
      view_count: meta.view_count,
      published_at: meta.published_at,
      status: 'imported',
      metadata: { channel_title: meta.channel_title },
      created_by: userId,
    } as any);
  }

  async transcribe(workspaceId: string, videoId: string, audioUrl?: string) {
    const video = await this.get(workspaceId, videoId);
    if (video.status === 'transcribing') {
      throw new BadRequestError('Video is already being transcribed');
    }
    const finalUrl = audioUrl ?? video.audio_url;
    if (!finalUrl) {
      throw new BadRequestError('Video has no audio_url — provide one with the request');
    }
    await video.update({ status: 'transcribing', audio_url: finalUrl, error: null });
    try {
      const result = await this.transcriptDriver.transcribe({
        audio_url: finalUrl,
        model: this.whisperModel,
      });
      await video.update({
        status: 'transcribed',
        transcript: result.transcript,
        transcript_language: result.language,
      });
    } catch (e: any) {
      await video.update({ status: 'failed', error: e.message?.slice(0, 1900) ?? 'unknown' });
      throw e;
    }
    return video;
  }

  async remove(workspaceId: string, id: string) {
    const video = await this.get(workspaceId, id);
    await video.destroy();
    return { id, removed: true };
  }
}
