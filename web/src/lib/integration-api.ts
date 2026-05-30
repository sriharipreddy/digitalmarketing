import { api } from './api';

export type ApiKeyStatus = 'active' | 'revoked' | 'expired';
export type WebhookStatus = 'active' | 'paused' | 'disabled';
export type DeliveryStatus = 'pending' | 'in_flight' | 'succeeded' | 'failed' | 'dead_letter';

export interface ApiKey {
  id: string;
  workspace_id: string;
  name: string;
  prefix: string;
  scopes: string[];
  status: ApiKeyStatus;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface CreatedApiKey extends ApiKey {
  secret: string; // shown ONCE
}

export interface Webhook {
  id: string;
  workspace_id: string;
  name: string;
  target_url: string;
  secret_last4: string | null;
  event_kinds: string[];
  status: WebhookStatus;
  last_delivery_at: string | null;
  consecutive_failures: number;
  created_at: string;
}

export type ImportSource = 'csv' | 'hubspot' | 'mailchimp' | 'klaviyo';
export type ImportStatus = 'pending' | 'mapping' | 'processing' | 'completed' | 'failed';

export interface DataImport {
  id: string;
  workspace_id: string;
  source: ImportSource;
  entity: 'contacts';
  status: ImportStatus;
  total_rows: number;
  processed_rows: number;
  succeeded_rows: number;
  failed_rows: number;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export type ExportKind = 'dsar' | 'workspace_backup' | 'segment_csv';
export type ExportStatus = 'pending' | 'building' | 'ready' | 'expired' | 'failed';

export interface DataExport {
  id: string;
  workspace_id: string;
  kind: ExportKind;
  subject_email: string | null;
  subject_user_id: string | null;
  status: ExportStatus;
  file_url: string | null;
  manifest: Record<string, unknown> | null;
  expires_at: string | null;
  error: string | null;
  created_at: string;
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event_id: string;
  event_kind: string;
  status: DeliveryStatus;
  attempts: number;
  last_attempt_at: string | null;
  next_attempt_at: string | null;
  response_status: number | null;
  error: string | null;
  delivered_at: string | null;
  created_at: string;
  webhook: { id: string; name: string; target_url: string } | null;
}

export const integrationApi = {
  listKeys: (workspaceId: string) =>
    api.get<{ data: { keys: ApiKey[] } }>(`/integration/workspaces/${workspaceId}/api-keys`),
  createKey: (workspaceId: string, body: { name: string; scopes?: string[]; expires_at?: string }) =>
    api.post<{ data: { key: CreatedApiKey } }>(`/integration/workspaces/${workspaceId}/api-keys`, body),
  revokeKey: (workspaceId: string, id: string) =>
    api.post<{ data: { key: ApiKey } }>(`/integration/workspaces/${workspaceId}/api-keys/${id}/revoke`),

  listWebhooks: (workspaceId: string) =>
    api.get<{ data: { webhooks: Webhook[] } }>(`/integration/workspaces/${workspaceId}/webhooks`),
  createWebhook: (
    workspaceId: string,
    body: { name: string; target_url: string; event_kinds: string[] },
  ) =>
    api.post<{ data: { webhook: Webhook; signing_secret: string } }>(
      `/integration/workspaces/${workspaceId}/webhooks`,
      body,
    ),
  updateWebhook: (
    workspaceId: string,
    id: string,
    patch: { status?: WebhookStatus; event_kinds?: string[]; target_url?: string },
  ) =>
    api.patch<{ data: { webhook: Webhook } }>(`/integration/workspaces/${workspaceId}/webhooks/${id}`, patch),
  removeWebhook: (workspaceId: string, id: string) =>
    api.delete<{ data: { id: string; removed: boolean } }>(`/integration/workspaces/${workspaceId}/webhooks/${id}`),

  listDeliveries: (workspaceId: string, opts?: { webhook_id?: string; status?: string; limit?: number }) =>
    api.get<{ data: { deliveries: WebhookDelivery[] } }>(
      `/integration/workspaces/${workspaceId}/webhook-deliveries`,
      { params: opts },
    ),

  // Imports
  listImports: (workspaceId: string) =>
    api.get<{ data: { imports: DataImport[] } }>(`/integration/workspaces/${workspaceId}/imports`),
  createImport: (workspaceId: string, body: { source: ImportSource; entity: 'contacts'; column_mapping?: Record<string, string> }) =>
    api.post<{ data: { import: DataImport } }>(`/integration/workspaces/${workspaceId}/imports`, body),
  runImport: (
    workspaceId: string,
    importId: string,
    body: {
      access_token?: string;
      api_key?: string;
      audience_id?: string;
      dc?: string;
      csv_body?: string;
      column_mapping?: Record<string, string>;
      use_stub?: boolean;
    },
  ) => api.post<{ data: { processed: number; succeeded: number; failed: number } }>(
    `/integration/workspaces/${workspaceId}/imports/${importId}/run`, body,
  ),

  // Exports
  listExports: (workspaceId: string) =>
    api.get<{ data: { exports: DataExport[] } }>(`/integration/workspaces/${workspaceId}/exports`),
  createDsar: (workspaceId: string, body: { subject_email?: string; subject_user_id?: string }) =>
    api.post<{ data: { export: DataExport } }>(`/integration/workspaces/${workspaceId}/exports/dsar`, body),
  getExport: (workspaceId: string, exportId: string) =>
    api.get<{ data: { export: DataExport } }>(`/integration/workspaces/${workspaceId}/exports/${exportId}`),
};
