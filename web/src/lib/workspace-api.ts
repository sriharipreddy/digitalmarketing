import { api } from './api';

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string | null;
  domain: string | null;
  industry: string | null;
  country: string | null;
  timezone: string;
  logo_url: string | null;
  plan_id: string | null;
  status: string;
  trial_ends_at: string | null;
  region: string;
}

export interface Membership {
  membership_id: string;
  role: 'owner' | 'editor' | 'analyst' | 'viewer';
  joined_at: string | null;
  workspace: WorkspaceSummary;
}

export interface Member {
  id: string;
  workspace_id: string;
  user_id: string;
  role: 'owner' | 'editor' | 'analyst' | 'viewer';
  status: 'active' | 'invited' | 'suspended';
  joined_at: string | null;
  invited_by: string | null;
  invite_expires_at: string | null;
  created_at: string;
  user: {
    id: string;
    full_name: string;
    email: string;
    avatar_url: string | null;
    status: string;
  } | null;
}

export interface AuditEntry {
  id: string;
  workspace_id: string | null;
  actor_user_id: string | null;
  actor_type: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  request_id: string | null;
  metadata: Record<string, unknown> | string | null;
  createdAt: string;
}

export const workspaceApi = {
  listMemberships: () => api.get<{ data: { memberships: Membership[] } }>('/core/workspaces'),
  get: (id: string) => api.get<{ data: { workspace: WorkspaceSummary; role: string } }>(`/core/workspaces/${id}`),
  update: (id: string, patch: Partial<Pick<WorkspaceSummary, 'name' | 'timezone' | 'industry' | 'country' | 'logo_url'>>) =>
    api.patch<{ data: { workspace: WorkspaceSummary; role: string } }>(`/core/workspaces/${id}`, patch),
  requestDelete: (id: string) => api.delete<{ data: { workspace: WorkspaceSummary } }>(`/core/workspaces/${id}`),
  listMembers: (id: string) => api.get<{ data: { members: Member[] } }>(`/core/workspaces/${id}/members`),
  invite: (id: string, body: { email: string; role: Member['role']; full_name?: string }) =>
    api.post<{ data: { member: Member; invite_token: string } }>(`/core/workspaces/${id}/members/invite`, body),
  updateRole: (workspaceId: string, memberId: string, role: Member['role']) =>
    api.patch<{ data: { member: Member } }>(`/core/workspaces/${workspaceId}/members/${memberId}`, { role }),
  removeMember: (workspaceId: string, memberId: string) =>
    api.delete<{ data: { id: string; removed: boolean } }>(`/core/workspaces/${workspaceId}/members/${memberId}`),
  acceptInvite: (token: string) =>
    api.post<{ data: { member: Member } }>('/core/invitations/accept', { invite_token: token }),
  listAudit: (id: string, params?: { limit?: number; offset?: number; action?: string; target_type?: string }) =>
    api.get<{ data: { rows: AuditEntry[]; total: number } }>(`/core/workspaces/${id}/audit-log`, { params }),
};
