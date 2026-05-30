import { api } from './api';

export interface OverviewMetrics {
  range: { since: string; until: string };
  totals: {
    events: number;
    unique_visitors: number;
    sessions: number;
    pageviews: number;
  };
  top_events: Array<{ event_name: string; count: number }>;
  top_pages: Array<{ page_url: string; views: number }>;
  by_day: Array<{ day: string; events: number; visitors: number }>;
}

export interface UtmAttribution {
  range: { since: string; until: string };
  by_campaign: Array<{ utm_campaign: string; visitors: number; events: number; conversions: number; value_usd: number }>;
  by_source: Array<{ utm_source: string; visitors: number; events: number }>;
  by_medium: Array<{ utm_medium: string; visitors: number; events: number }>;
}

export interface FunnelResult {
  range: { since: string; until: string };
  steps: Array<{ step: number; event_name: string; visitors: number; drop_off: number }>;
}

export interface ConversionGoal {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  event_name: string;
  property_filters: Record<string, string> | null;
  value_usd: number;
  is_active: boolean;
  created_at: string;
}

export interface TrackPayload {
  workspace_id: string;
  anonymous_id: string;
  event_name: string;
  contact_email?: string;
  page_url?: string;
  properties?: Record<string, unknown>;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
}

export const analyticsApi = {
  overview: (workspaceId: string, days = 30) =>
    api.get<{ data: OverviewMetrics }>(`/analytics/workspaces/${workspaceId}/overview`, {
      params: { days },
    }),
  utm: (workspaceId: string, days = 30) =>
    api.get<{ data: UtmAttribution }>(`/analytics/workspaces/${workspaceId}/utm-attribution`, {
      params: { days },
    }),
  funnel: (workspaceId: string, events: string[], days = 30) =>
    api.post<{ data: FunnelResult }>(`/analytics/workspaces/${workspaceId}/funnel`, { events, days }),

  listGoals: (workspaceId: string) =>
    api.get<{ data: { goals: ConversionGoal[] } }>(`/analytics/workspaces/${workspaceId}/goals`),
  createGoal: (
    workspaceId: string,
    body: { name: string; description?: string; event_name: string; value_usd?: number },
  ) =>
    api.post<{ data: { goal: ConversionGoal } }>(`/analytics/workspaces/${workspaceId}/goals`, body),
  removeGoal: (workspaceId: string, goalId: string) =>
    api.delete<{ data: { id: string; removed: boolean } }>(
      `/analytics/workspaces/${workspaceId}/goals/${goalId}`,
    ),

  // PUBLIC — no auth required.
  track: (body: TrackPayload) => api.post<{ data: { id: string } }>('/analytics/track', body),
};
