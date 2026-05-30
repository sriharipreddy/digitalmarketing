import { api } from './api';

export type LifecycleStage =
  | 'subscriber'
  | 'lead'
  | 'mql'
  | 'sql'
  | 'customer'
  | 'evangelist'
  | 'churned';

export interface Contact {
  id: string;
  workspace_id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  company: string | null;
  lifecycle_stage: LifecycleStage;
  source: string | null;
  lead_score: number;
  tags: string[] | null;
  custom_fields: Record<string, unknown> | null;
  unsubscribed: boolean;
  created_at: string;
}

export interface FormFieldSpec {
  name: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'textarea' | 'select' | 'checkbox';
  required?: boolean;
  options?: string[];
}

export interface LeadForm {
  id: string;
  workspace_id: string;
  slug: string;
  name: string;
  description: string | null;
  fields: FormFieldSpec[];
  on_submit_tags: string[] | null;
  on_submit_lifecycle: LifecycleStage | null;
  success_message: string;
  is_active: boolean;
  submission_count: number;
  created_at: string;
}

export const crmApi = {
  listContacts: (workspaceId: string, opts?: { limit?: number; offset?: number; stage?: string }) =>
    api.get<{ data: { rows: Contact[]; total: number } }>(
      `/crm/workspaces/${workspaceId}/contacts`,
      { params: opts },
    ),
  createContact: (
    workspaceId: string,
    body: Partial<Pick<Contact, 'email' | 'first_name' | 'last_name' | 'phone' | 'company' | 'lifecycle_stage' | 'tags'>>,
  ) =>
    api.post<{ data: { contact: Contact } }>(`/crm/workspaces/${workspaceId}/contacts`, body),
  updateContact: (workspaceId: string, contactId: string, patch: Record<string, unknown>) =>
    api.patch<{ data: { contact: Contact } }>(
      `/crm/workspaces/${workspaceId}/contacts/${contactId}`,
      patch,
    ),
  removeContact: (workspaceId: string, contactId: string) =>
    api.delete<{ data: { id: string; removed: boolean } }>(
      `/crm/workspaces/${workspaceId}/contacts/${contactId}`,
    ),

  listForms: (workspaceId: string) =>
    api.get<{ data: { forms: LeadForm[] } }>(`/crm/workspaces/${workspaceId}/forms`),
  createForm: (
    workspaceId: string,
    body: {
      name: string;
      description?: string;
      fields: FormFieldSpec[];
      on_submit_tags?: string[];
      on_submit_lifecycle?: 'subscriber' | 'lead' | 'mql';
      success_message?: string;
    },
  ) =>
    api.post<{ data: { form: LeadForm } }>(`/crm/workspaces/${workspaceId}/forms`, body),
  removeForm: (workspaceId: string, formId: string) =>
    api.delete<{ data: { id: string; removed: boolean } }>(
      `/crm/workspaces/${workspaceId}/forms/${formId}`,
    ),

  // ─── Segments ──────────────────────────────────────────────────────
  listSegments: (workspaceId: string) =>
    api.get<{ data: { segments: Segment[] } }>(`/crm/workspaces/${workspaceId}/segments`),
  createSegment: (workspaceId: string, body: { name: string; description?: string; definition: SegmentDefinition }) =>
    api.post<{ data: { segment: Segment } }>(`/crm/workspaces/${workspaceId}/segments`, body),
  removeSegment: (workspaceId: string, id: string) =>
    api.delete<void>(`/crm/workspaces/${workspaceId}/segments/${id}`),
  previewSegment: (workspaceId: string, definition: SegmentDefinition, limit?: number) =>
    api.post<{ data: { count: number; sample: Contact[] } }>(
      `/crm/workspaces/${workspaceId}/segments/preview`, { definition, limit },
    ),
  segmentMembers: (workspaceId: string, segmentId: string, opts?: { limit?: number; offset?: number }) =>
    api.get<{ data: { total: number; rows: Contact[] } }>(
      `/crm/workspaces/${workspaceId}/segments/${segmentId}/members`, { params: opts },
    ),
  evaluateSegment: (workspaceId: string, segmentId: string) =>
    api.post<{ data: { count: number } }>(`/crm/workspaces/${workspaceId}/segments/${segmentId}/evaluate`),

  // ─── NPS ───────────────────────────────────────────────────────────
  submitNps: (workspaceId: string, body: { score: number; email?: string; comment?: string; survey_id?: string }) =>
    api.post<{ data: { response: NpsResponse } }>(`/crm/workspaces/${workspaceId}/nps`, body),
  listNps: (workspaceId: string, opts?: { limit?: number }) =>
    api.get<{ data: { responses: NpsResponse[] } }>(`/crm/workspaces/${workspaceId}/nps`, { params: opts }),
  npsSummary: (workspaceId: string) =>
    api.get<{ data: { total: number; score: number | null; breakdown: { promoter: number; passive: number; detractor: number } } }>(
      `/crm/workspaces/${workspaceId}/nps/summary`,
    ),

  // ─── RFM ───────────────────────────────────────────────────────────
  analyzeRfm: (workspaceId: string, orders: Array<{ contact_id: string; last_order_at: string | null; order_count: number; lifetime_value_usd: number }>) =>
    api.post<{ data: { scored: number; segments: Record<string, number> } }>(
      `/crm/workspaces/${workspaceId}/rfm/analyze`, { orders },
    ),
  rfmSummary: (workspaceId: string) =>
    api.get<{ data: { total: number; ltv_total_usd: number; segments: Record<string, { count: number; ltv_total: number }> } }>(
      `/crm/workspaces/${workspaceId}/rfm/summary`,
    ),
};

export type SegmentFilterOp =
  | 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'
  | 'in' | 'nin' | 'contains' | 'starts_with' | 'ends_with' | 'exists' | 'not_exists';

export interface SegmentFilter {
  field: string;
  op: SegmentFilterOp;
  value?: unknown;
}

export interface SegmentDefinition {
  filters: SegmentFilter[];
}

export interface Segment {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  definition: SegmentDefinition;
  member_count: number;
  last_evaluated_at: string | null;
  created_at: string;
}

export interface NpsResponse {
  id: string;
  workspace_id: string;
  email: string | null;
  score: number;
  bucket: 'detractor' | 'passive' | 'promoter';
  comment: string | null;
  submitted_at: string;
}
