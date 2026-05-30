import { api } from './api';

export type AdPlatform = 'meta' | 'google' | 'linkedin' | 'tiktok';
export type RecommendationCategory =
  | 'budget_reallocation'
  | 'new_keyword'
  | 'paused_competitor_opportunity'
  | 'channel_expansion'
  | 'audience_segment'
  | 'creative_refresh';
export type RecommendationStatus = 'new' | 'accepted' | 'dismissed' | 'in_progress' | 'completed';

export interface Competitor {
  id: string;
  workspace_id: string;
  name: string;
  domain: string;
  description: string | null;
  industry: string | null;
  est_monthly_traffic: number | null;
  est_employee_count: string | null;
  social_handles: Record<string, string> | null;
  strengths: string[] | null;
  weaknesses: string[] | null;
  last_analyzed_at: string | null;
  created_at: string;
}

export interface CompetitorAd {
  id: string;
  competitor_id: string;
  platform: AdPlatform;
  external_id: string;
  creative_url: string | null;
  headline: string | null;
  body: string | null;
  landing_url: string | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  est_spend_usd: number | null;
  est_impressions: number | null;
  competitor: { id: string; name: string; domain: string } | null;
}

export interface Recommendation {
  id: string;
  workspace_id: string;
  category: RecommendationCategory;
  title: string;
  body: string;
  impact_estimate: string | null;
  confidence: 'low' | 'medium' | 'high';
  related_entities: Record<string, unknown> | null;
  status: RecommendationStatus;
  actioned_at: string | null;
  created_at: string;
}

export const intelligenceApi = {
  listCompetitors: (workspaceId: string) =>
    api.get<{ data: { competitors: Competitor[] } }>(
      `/intelligence/workspaces/${workspaceId}/competitors`,
    ),
  createCompetitor: (workspaceId: string, body: { name: string; domain: string }) =>
    api.post<{ data: { competitor: Competitor } }>(
      `/intelligence/workspaces/${workspaceId}/competitors`,
      body,
    ),
  analyzeCompetitor: (workspaceId: string, id: string) =>
    api.post<{ data: { competitor: Competitor } }>(
      `/intelligence/workspaces/${workspaceId}/competitors/${id}/analyze`,
    ),
  spyAds: (workspaceId: string, id: string, body: { platform: AdPlatform; limit?: number }) =>
    api.post<{ data: { saved: number; ads: CompetitorAd[] } }>(
      `/intelligence/workspaces/${workspaceId}/competitors/${id}/spy`,
      body,
    ),
  removeCompetitor: (workspaceId: string, id: string) =>
    api.delete<{ data: { id: string; removed: boolean } }>(
      `/intelligence/workspaces/${workspaceId}/competitors/${id}`,
    ),

  listAds: (workspaceId: string, opts?: { competitor_id?: string; platform?: AdPlatform }) =>
    api.get<{ data: { ads: CompetitorAd[] } }>(`/intelligence/workspaces/${workspaceId}/ads`, {
      params: opts,
    }),

  listRecommendations: (workspaceId: string, opts?: { status?: string }) =>
    api.get<{ data: { recommendations: Recommendation[] } }>(
      `/intelligence/workspaces/${workspaceId}/autopilot/recommendations`,
      { params: opts },
    ),
  scan: (workspaceId: string) =>
    api.post<{ data: { created: number; recommendations: Recommendation[] } }>(
      `/intelligence/workspaces/${workspaceId}/autopilot/scan`,
    ),
  actOn: (workspaceId: string, id: string, outcome: 'accepted' | 'dismissed' | 'in_progress' | 'completed') =>
    api.post<{ data: { recommendation: Recommendation } }>(
      `/intelligence/workspaces/${workspaceId}/autopilot/recommendations/${id}/act`,
      { outcome },
    ),
};
