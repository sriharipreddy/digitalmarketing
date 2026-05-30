import { api } from './api';

export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'completed' | 'paused' | 'cancelled';
export type ChannelKind =
  | 'email'
  | 'sms'
  | 'push'
  | 'facebook'
  | 'instagram'
  | 'linkedin'
  | 'twitter'
  | 'tiktok'
  | 'google_ads';
export type ChannelStatus = 'pending' | 'queued' | 'sent' | 'failed' | 'skipped';

export interface CampaignChannel {
  id: string;
  kind: ChannelKind;
  status: ChannelStatus;
  config: Record<string, unknown>;
  external_id: string | null;
  error: string | null;
  sent_at: string | null;
}

export interface Campaign {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  kind: 'email' | 'social' | 'multi_channel' | 'one_click';
  status: CampaignStatus;
  goal: string | null;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  channels: CampaignChannel[];
  createdAt: string;
}

export interface UtmLink {
  id: string;
  workspace_id: string;
  campaign_id: string | null;
  short_code: string;
  destination_url: string;
  source: string;
  medium: string;
  campaign: string;
  term: string | null;
  content: string | null;
  click_count: number;
  created_at: string;
}

export const campaignApi = {
  list: (workspaceId: string, opts?: { status?: string; limit?: number; offset?: number }) =>
    api.get<{ data: { rows: Campaign[]; total: number } }>(
      `/campaign/workspaces/${workspaceId}/campaigns`,
      { params: opts },
    ),
  get: (workspaceId: string, id: string) =>
    api.get<{ data: { campaign: Campaign } }>(`/campaign/workspaces/${workspaceId}/campaigns/${id}`),
  create: (
    workspaceId: string,
    body: {
      name: string;
      description?: string;
      kind: Campaign['kind'];
      goal?: string;
      channels?: Array<{ kind: ChannelKind; config: Record<string, unknown> }>;
    },
  ) =>
    api.post<{ data: { campaign: Campaign } }>(
      `/campaign/workspaces/${workspaceId}/campaigns`,
      body,
    ),
  dispatch: (workspaceId: string, id: string) =>
    api.post<{
      data: { campaign_id: string; status: string; results: Array<{ channel_id: string; kind: string; status: string; external_id?: string; error?: string }> };
    }>(`/campaign/workspaces/${workspaceId}/campaigns/${id}/dispatch`),
  remove: (workspaceId: string, id: string) =>
    api.delete<{ data: { id: string; removed: boolean } }>(
      `/campaign/workspaces/${workspaceId}/campaigns/${id}`,
    ),

  listUtm: (workspaceId: string, opts?: { campaign_id?: string }) =>
    api.get<{ data: { rows: UtmLink[]; total: number } }>(
      `/campaign/workspaces/${workspaceId}/utm-links`,
      { params: opts },
    ),
  createUtm: (
    workspaceId: string,
    body: {
      destination_url: string;
      source: string;
      medium: string;
      campaign: string;
      term?: string;
      content?: string;
      campaign_id?: string;
    },
  ) =>
    api.post<{ data: { link: UtmLink } }>(
      `/campaign/workspaces/${workspaceId}/utm-links`,
      body,
    ),
  removeUtm: (workspaceId: string, linkId: string) =>
    api.delete<{ data: { id: string; removed: boolean } }>(
      `/campaign/workspaces/${workspaceId}/utm-links/${linkId}`,
    ),

  /** Path the One-Click SSE endpoint lives at — the page opens it via fetch + ReadableStream. */
  oneClickPath: (workspaceId: string) => `/api/v1/campaign/workspaces/${workspaceId}/one-click`,
};

