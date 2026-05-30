import { api } from './api';

export interface AudienceFilter {
  tag_includes?: string[];
  tag_excludes?: string[];
  lifecycle_in?: string[];
  source_match?: string;
}

export interface EmailList {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  filter: AudienceFilter;
  created_at: string;
}

export interface EmailSend {
  id: string;
  workspace_id: string;
  list_id: string | null;
  subject: string;
  from_email: string;
  from_name: string;
  status: 'queued' | 'sending' | 'completed' | 'failed' | 'partial';
  audience_size: number;
  sent_count: number;
  failed_count: number;
  opens: number;
  clicks: number;
  bounces: number;
  unsubscribes: number;
  created_at: string;
}

export const emailApi = {
  listLists: (workspaceId: string) =>
    api.get<{ data: { lists: EmailList[] } }>(`/email/workspaces/${workspaceId}/lists`),
  createList: (workspaceId: string, body: { name: string; description?: string; filter: AudienceFilter }) =>
    api.post<{ data: { list: EmailList } }>(`/email/workspaces/${workspaceId}/lists`, body),
  previewList: (workspaceId: string, listId: string) =>
    api.get<{ data: { size: number; sample: string[] } }>(
      `/email/workspaces/${workspaceId}/lists/${listId}/preview`,
    ),
  previewFilter: (workspaceId: string, filter: AudienceFilter) =>
    api.post<{ data: { size: number; sample: string[] } }>(
      `/email/workspaces/${workspaceId}/lists/preview`,
      { filter },
    ),
  removeList: (workspaceId: string, listId: string) =>
    api.delete<{ data: { id: string; removed: boolean } }>(
      `/email/workspaces/${workspaceId}/lists/${listId}`,
    ),

  send: (
    workspaceId: string,
    body: {
      list_id?: string;
      inline_filter?: AudienceFilter;
      subject: string;
      html: string;
      text?: string;
      utm?: { source: string; medium: string; campaign: string };
    },
  ) =>
    api.post<{ data: { send_id: string; audience_size: number; status: string } }>(
      `/email/workspaces/${workspaceId}/sends`,
      body,
    ),
  listSends: (workspaceId: string, opts?: { limit?: number; offset?: number }) =>
    api.get<{ data: { rows: EmailSend[]; total: number } }>(
      `/email/workspaces/${workspaceId}/sends`,
      { params: opts },
    ),
};

export type MessagingChannel = 'sms' | 'whatsapp' | 'push';
export type MessageStatus = 'queued' | 'sending' | 'sent' | 'failed' | 'delivered' | 'bounced';

export interface MessageRow {
  id: string;
  workspace_id: string;
  channel: MessagingChannel;
  to_address: string;
  from_address: string | null;
  body: string;
  template_external_id: string | null;
  status: MessageStatus;
  provider_message_id: string | null;
  error: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  created_at: string;
}

export interface MessagingSuppression {
  id: string;
  workspace_id: string;
  channel: MessagingChannel;
  address: string;
  reason: string | null;
  suppressed_at: string;
}

export const messagingApi = {
  send: (workspaceId: string, body: {
    channel: MessagingChannel;
    to: string;
    body: string;
    from?: string;
    template_external_id?: string;
    metadata?: Record<string, unknown>;
    recipient_timezone?: string;
  }) =>
    api.post<{ data: { message: MessageRow } }>(`/email/workspaces/${workspaceId}/messages`, body),
  list: (workspaceId: string, opts?: { channel?: MessagingChannel; limit?: number }) =>
    api.get<{ data: { messages: MessageRow[] } }>(`/email/workspaces/${workspaceId}/messages`, { params: opts }),
  listSuppressions: (workspaceId: string, channel?: MessagingChannel) =>
    api.get<{ data: { suppressions: MessagingSuppression[] } }>(
      `/email/workspaces/${workspaceId}/messaging/suppressions`,
      { params: channel ? { channel } : undefined },
    ),
  suppress: (workspaceId: string, body: { channel: MessagingChannel; address: string; reason?: string }) =>
    api.post<{ data: { suppression: MessagingSuppression } }>(
      `/email/workspaces/${workspaceId}/messaging/suppressions`, body,
    ),
  unsuppress: (workspaceId: string, body: { channel: MessagingChannel; address: string }) =>
    api.delete<void>(
      `/email/workspaces/${workspaceId}/messaging/suppressions`,
      { data: body },
    ),
};
