import { api } from './api';

export interface ResearchResult {
  keyword: string;
  search_volume: number | null;
  difficulty: number | null;
  cpc: number | null;
  intent: 'informational' | 'navigational' | 'transactional' | 'commercial' | null;
}

export interface SavedKeyword extends ResearchResult {
  id: string;
  workspace_id: string;
  country: string;
  language: string;
  tags: string[] | null;
  created_at: string;
}

export type LocalProvider = 'gmb' | 'apple_maps' | 'bing_places' | 'yelp';
export type LocalListingStatus = 'pending_verification' | 'verified' | 'suspended' | 'disconnected';
export type CitationStatus = 'pending' | 'submitted' | 'live' | 'rejected';
export type AppPlatform = 'ios' | 'android';

export interface LocalListing {
  id: string;
  workspace_id: string;
  provider: LocalProvider;
  provider_account_id: string;
  business_name: string;
  address_line1: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country: string;
  phone: string | null;
  website_url: string | null;
  categories: string[] | null;
  status: LocalListingStatus;
  last_sync_at: string | null;
  created_at: string;
}

export interface LocalReview {
  id: string;
  listing_id: string;
  provider_review_id: string;
  author_name: string | null;
  rating: number;
  body: string | null;
  response_body: string | null;
  sentiment: 'positive' | 'neutral' | 'negative' | null;
  posted_at: string;
  responded_at: string | null;
}

export interface LocalCitation {
  id: string;
  listing_id: string;
  directory_name: string;
  directory_url: string;
  submission_url: string | null;
  status: CitationStatus;
  submitted_at: string | null;
  verified_at: string | null;
  notes: string | null;
}

export interface AppListing {
  id: string;
  workspace_id: string;
  platform: AppPlatform;
  app_external_id: string;
  app_name: string;
  developer_name: string | null;
  category: string | null;
  current_version: string | null;
  rating_average: number | null;
  rating_count: number | null;
  keywords: string[] | null;
  description_short: string | null;
  last_sync_at: string | null;
}

export const seoApi = {
  list: (workspaceId: string) =>
    api.get<{ data: { rows: SavedKeyword[]; total: number } }>(
      `/seo/workspaces/${workspaceId}/keywords`,
    ),
  research: (workspaceId: string, seed: string, opts?: { country?: string; limit?: number }) =>
    api.post<{ data: { country: string; language: string; results: ResearchResult[]; driver?: 'stub' | 'live' } }>(
      `/seo/workspaces/${workspaceId}/keywords/research`,
      { seed, ...(opts ?? {}) },
    ),
  save: (workspaceId: string, items: ResearchResult[]) =>
    api.post<{ data: { saved: number } }>(`/seo/workspaces/${workspaceId}/keywords`, { items }),
  remove: (workspaceId: string, keywordId: string) =>
    api.delete<{ data: { id: string; removed: boolean } }>(
      `/seo/workspaces/${workspaceId}/keywords/${keywordId}`,
    ),

  // ─── Local SEO ─────────────────────────────────────────────────────
  listListings: (workspaceId: string) =>
    api.get<{ data: { listings: LocalListing[] } }>(`/seo/workspaces/${workspaceId}/local/listings`),
  createListing: (workspaceId: string, body: { provider: LocalProvider; provider_account_id: string; business_name: string; address_line1?: string; city?: string; region?: string; postal_code?: string; country?: string; phone?: string; website_url?: string; categories?: string[] }) =>
    api.post<{ data: { listing: LocalListing } }>(`/seo/workspaces/${workspaceId}/local/listings`, body),
  removeListing: (workspaceId: string, id: string) =>
    api.delete<void>(`/seo/workspaces/${workspaceId}/local/listings/${id}`),
  syncReviews: (workspaceId: string, listingId: string) =>
    api.post<{ data: { inserted: number; total: number } }>(`/seo/workspaces/${workspaceId}/local/listings/${listingId}/sync`),
  listReviews: (workspaceId: string, listingId: string) =>
    api.get<{ data: { reviews: LocalReview[] } }>(`/seo/workspaces/${workspaceId}/local/listings/${listingId}/reviews`),
  respondReview: (workspaceId: string, listingId: string, reviewId: string, body: string) =>
    api.post<{ data: { review: LocalReview } }>(
      `/seo/workspaces/${workspaceId}/local/listings/${listingId}/reviews/${reviewId}/respond`,
      { body },
    ),
  listCitations: (workspaceId: string, listingId: string) =>
    api.get<{ data: { citations: LocalCitation[] } }>(`/seo/workspaces/${workspaceId}/local/listings/${listingId}/citations`),
  seedCitations: (workspaceId: string, listingId: string) =>
    api.post<{ data: { created: number; total: number } }>(`/seo/workspaces/${workspaceId}/local/listings/${listingId}/citations/seed`),
  updateCitationStatus: (workspaceId: string, citationId: string, status: CitationStatus, submission_url?: string | null) =>
    api.patch<{ data: { citation: LocalCitation } }>(`/seo/workspaces/${workspaceId}/local/citations/${citationId}`, { status, submission_url }),

  // ─── ASO ───────────────────────────────────────────────────────────
  listApps: (workspaceId: string) =>
    api.get<{ data: { apps: AppListing[] } }>(`/seo/workspaces/${workspaceId}/aso/apps`),
  trackApp: (workspaceId: string, body: { platform: AppPlatform; app_external_id: string }) =>
    api.post<{ data: { app: AppListing } }>(`/seo/workspaces/${workspaceId}/aso/apps`, body),
  syncApp: (workspaceId: string, appId: string) =>
    api.post<{ data: { app: AppListing } }>(`/seo/workspaces/${workspaceId}/aso/apps/${appId}/sync`),
  removeApp: (workspaceId: string, appId: string) =>
    api.delete<void>(`/seo/workspaces/${workspaceId}/aso/apps/${appId}`),
};
