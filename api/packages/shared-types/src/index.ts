/**
 * Shared TypeScript types used across services + the frontend.
 * Only stable, cross-service contracts go here.
 */

// ─── Identity & Authorization ─────────────────────────────────────────────

export type UserType = 'platform_admin' | 'agency_owner' | 'client_owner' | 'team_member';
export type UserStatus = 'active' | 'suspended' | 'invited' | 'pending_verify';
export type MemberRole = 'owner' | 'editor' | 'analyst' | 'viewer';
export type MemberStatus = 'active' | 'invited' | 'suspended';

export type WorkspaceStatus =
  | 'trial'
  | 'active'
  | 'past_due'
  | 'suspended'
  | 'cancelled'
  | 'pending_deletion'
  | 'deleted';

export interface JwtPayload {
  id: string;                    // user_id
  type: UserType;
  workspace_id?: string;         // null for platform_admin until they pick a workspace
  workspace_name?: string;
  agency_id?: string;
  name: string;
  email: string;
  avatar?: string;
  role?: MemberRole;
  permissions?: PermissionEntry[];
}

export interface PermissionEntry {
  module_name: string;
  access: { c?: boolean; r?: boolean; u?: boolean; d?: boolean };
}

// Service-to-service JWT — short-lived, no user context
export interface ServiceJwtPayload {
  type: 'service';
  from: string;                  // calling service name
  to: string;                    // target service name
  workspace_id?: string;         // optional context
  exp: number;
}

// ─── Standard API response envelopes ───────────────────────────────────────

export interface ApiSuccess<T> {
  data: T;
  meta?: PaginationMeta;
  links?: PaginationLinks;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    request_id: string;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total_pages: number;
  total_count: number;
}

export interface PaginationLinks {
  self: string;
  next?: string;
  prev?: string;
  first: string;
  last: string;
}

// ─── Async event envelope ─────────────────────────────────────────────────

export interface PlatformEvent<TData = unknown> {
  event_id: string;              // ULID
  event_type: string;            // e.g., 'core.workspace.created'
  occurred_at: string;           // ISO timestamp
  workspace_id?: string;
  actor: { type: 'user' | 'system' | 'admin_impersonation' | 'api_key'; id?: string };
  data: TData;
  metadata: { request_id?: string; schema_version: string };
}

// ─── Common entity shapes (subset; full models live in each service) ───────

export interface PublicUser {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
  type: UserType;
}

export interface PublicWorkspace {
  id: string;
  name: string;
  slug?: string;
  domain?: string;
  plan_id?: string;
  status: WorkspaceStatus;
  region: string;
}
