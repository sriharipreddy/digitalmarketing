import { api } from './api';

export type ProgramStatus = 'draft' | 'active' | 'paused' | 'archived';
export type AffiliateStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type CommissionStatus = 'pending' | 'approved' | 'paid' | 'reversed' | 'rejected';

export interface AffiliateProgram {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  commission_kind: 'percent' | 'fixed_usd';
  commission_value: number;
  attribution: 'first_click' | 'last_click';
  cookie_days: number;
  status: ProgramStatus;
  terms_url: string | null;
  created_at: string;
}

export interface Affiliate {
  id: string;
  workspace_id: string;
  program_id: string;
  email: string;
  full_name: string | null;
  payout_method: string | null;
  status: AffiliateStatus;
  approved_at: string | null;
  created_at: string;
  program?: { id: string; name: string };
}

export interface TrackingLink {
  id: string;
  workspace_id: string;
  affiliate_id: string;
  short_code: string;
  destination_url: string;
  click_count: number;
  conversion_count: number;
  label: string | null;
  created_at: string;
  affiliate?: { id: string; email: string };
}

export interface Commission {
  id: string;
  workspace_id: string;
  affiliate_id: string;
  tracking_link_id: string | null;
  order_external_id: string;
  order_amount_usd: number;
  commission_usd: number;
  currency: string;
  customer_email: string | null;
  status: CommissionStatus;
  approved_at: string | null;
  paid_at: string | null;
  created_at: string;
  affiliate?: { id: string; email: string };
}

export interface CommissionTotals {
  pending: { count: number; usd: number };
  approved: { count: number; usd: number };
  paid: { count: number; usd: number };
  reversed: { count: number; usd: number };
  rejected: { count: number; usd: number };
}

export const affiliateApi = {
  listPrograms: (workspaceId: string) =>
    api.get<{ data: { programs: AffiliateProgram[] } }>(`/affiliate/workspaces/${workspaceId}/programs`),
  createProgram: (
    workspaceId: string,
    body: {
      name: string;
      description?: string;
      commission_kind?: 'percent' | 'fixed_usd';
      commission_value?: number;
      cookie_days?: number;
    },
  ) =>
    api.post<{ data: { program: AffiliateProgram } }>(
      `/affiliate/workspaces/${workspaceId}/programs`,
      body,
    ),
  updateProgram: (
    workspaceId: string,
    programId: string,
    patch: { status?: ProgramStatus; commission_value?: number; cookie_days?: number; description?: string },
  ) =>
    api.patch<{ data: { program: AffiliateProgram } }>(
      `/affiliate/workspaces/${workspaceId}/programs/${programId}`,
      patch,
    ),
  removeProgram: (workspaceId: string, programId: string) =>
    api.delete<{ data: { id: string; removed: boolean } }>(
      `/affiliate/workspaces/${workspaceId}/programs/${programId}`,
    ),

  listAffiliates: (workspaceId: string, opts?: { status?: string; program_id?: string }) =>
    api.get<{ data: { affiliates: Affiliate[] } }>(`/affiliate/workspaces/${workspaceId}/affiliates`, {
      params: opts,
    }),
  updateAffiliateStatus: (workspaceId: string, id: string, status: AffiliateStatus) =>
    api.patch<{ data: { affiliate: Affiliate } }>(
      `/affiliate/workspaces/${workspaceId}/affiliates/${id}`,
      { status },
    ),

  listLinks: (workspaceId: string, opts?: { affiliate_id?: string }) =>
    api.get<{ data: { links: TrackingLink[] } }>(`/affiliate/workspaces/${workspaceId}/tracking-links`, {
      params: opts,
    }),
  createLink: (
    workspaceId: string,
    body: { affiliate_id: string; destination_url: string; label?: string },
  ) =>
    api.post<{ data: { link: TrackingLink } }>(
      `/affiliate/workspaces/${workspaceId}/tracking-links`,
      body,
    ),
  removeLink: (workspaceId: string, linkId: string) =>
    api.delete<{ data: { id: string; removed: boolean } }>(
      `/affiliate/workspaces/${workspaceId}/tracking-links/${linkId}`,
    ),

  listCommissions: (workspaceId: string, opts?: { affiliate_id?: string; status?: string }) =>
    api.get<{ data: { commissions: Commission[] } }>(
      `/affiliate/workspaces/${workspaceId}/commissions`,
      { params: opts },
    ),
  recordCommission: (
    workspaceId: string,
    body: { affiliate_id: string; order_external_id: string; order_amount_usd: number; tracking_link_id?: string; customer_email?: string },
  ) =>
    api.post<{ data: { commission: Commission } }>(
      `/affiliate/workspaces/${workspaceId}/commissions`,
      body,
    ),
  transitionCommission: (
    workspaceId: string,
    commissionId: string,
    status: 'approved' | 'paid' | 'reversed' | 'rejected',
  ) =>
    api.post<{ data: { commission: Commission } }>(
      `/affiliate/workspaces/${workspaceId}/commissions/${commissionId}/transition`,
      { status },
    ),
  commissionSummary: (workspaceId: string) =>
    api.get<{ data: { totals: CommissionTotals } }>(
      `/affiliate/workspaces/${workspaceId}/commissions/summary`,
    ),

  /**
   * Public click redirect URL — resolves through the Vite proxy / Nginx upstream.
   * Set VITE_AFFILIATE_REDIRECT_BASE for a tracking subdomain in production.
   */
  publicLinkUrl: (short_code: string): string => {
    const base = import.meta.env.VITE_AFFILIATE_REDIRECT_BASE ?? `${window.location.origin}/api/v1/affiliate`;
    return `${base}/a/${short_code}`;
  },
};
