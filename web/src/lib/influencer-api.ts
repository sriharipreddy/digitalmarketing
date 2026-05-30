import { api } from './api';

export type InfluencerPlatform = 'instagram' | 'tiktok' | 'youtube' | 'twitter' | 'linkedin';
export type InfluencerStatus = 'discovered' | 'shortlisted' | 'contacted' | 'negotiating' | 'contracted' | 'declined' | 'paused';
export type OutreachStatus = 'draft' | 'sent' | 'replied' | 'accepted' | 'declined' | 'no_reply';

export interface Influencer {
  id: string;
  workspace_id: string;
  platform: InfluencerPlatform;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  followers: number;
  engagement_rate: number;
  audience_country: string | null;
  topics: string[] | null;
  estimated_cost_usd: number | null;
  status: InfluencerStatus;
  notes: string | null;
  last_contacted_at: string | null;
  created_at: string;
}

export interface Outreach {
  id: string;
  workspace_id: string;
  influencer_id: string;
  channel: 'email' | 'dm' | 'phone';
  subject: string | null;
  body: string;
  status: OutreachStatus;
  sent_at: string | null;
  replied_at: string | null;
  reply_summary: string | null;
  created_at: string;
  influencer: { id: string; platform: InfluencerPlatform; handle: string; display_name: string | null } | null;
}

export const influencerApi = {
  list: (workspaceId: string, opts?: { status?: string; platform?: string; limit?: number }) =>
    api.get<{ data: { rows: Influencer[]; total: number } }>(
      `/influencer/workspaces/${workspaceId}/influencers`,
      { params: opts },
    ),
  discover: (
    workspaceId: string,
    body: { platform: InfluencerPlatform; topic?: string; country?: string; min_followers?: number; limit?: number },
  ) =>
    api.post<{ data: { discovered: number; influencers: Influencer[] } }>(
      `/influencer/workspaces/${workspaceId}/influencers/discover`,
      body,
    ),
  updateStatus: (workspaceId: string, id: string, status: InfluencerStatus, notes?: string) =>
    api.patch<{ data: { influencer: Influencer } }>(
      `/influencer/workspaces/${workspaceId}/influencers/${id}`,
      { status, notes },
    ),
  remove: (workspaceId: string, id: string) =>
    api.delete<{ data: { id: string; removed: boolean } }>(
      `/influencer/workspaces/${workspaceId}/influencers/${id}`,
    ),

  listOutreach: (workspaceId: string, opts?: { influencer_id?: string }) =>
    api.get<{ data: { rows: Outreach[]; total: number } }>(
      `/influencer/workspaces/${workspaceId}/outreach`,
      { params: opts },
    ),
  draft: (
    workspaceId: string,
    body: { influencer_id: string; channel?: 'email' | 'dm' | 'phone'; campaign_brief: string },
  ) =>
    api.post<{ data: { outreach: Outreach } }>(
      `/influencer/workspaces/${workspaceId}/outreach/draft`,
      body,
    ),
  sendOutreach: (workspaceId: string, outreachId: string) =>
    api.post<{ data: { outreach: Outreach } }>(
      `/influencer/workspaces/${workspaceId}/outreach/${outreachId}/send`,
    ),
};
