import { api } from './api';

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error';
export type NotificationKind =
  | 'campaign.completed'
  | 'campaign.failed'
  | 'email.bounced'
  | 'email.unsubscribed'
  | 'social.post_published'
  | 'social.post_failed'
  | 'member.invited'
  | 'member.joined'
  | 'billing.payment_failed'
  | 'billing.subscription_upgraded'
  | 'commission.recorded'
  | 'commission.paid'
  | 'autopilot.recommendation'
  | 'system.alert'
  | 'custom';

export interface Notification {
  id: string;
  workspace_id: string;
  user_id: string | null;
  kind: NotificationKind;
  severity: NotificationSeverity;
  title: string;
  body: string | null;
  action_url: string | null;
  metadata: Record<string, unknown> | null;
  read_at: string | null;
  from_service: string;
  created_at: string;
}

export const notificationApi = {
  list: (workspaceId: string, opts?: { unread_only?: boolean; limit?: number; offset?: number }) =>
    api.get<{ data: { rows: Notification[]; total: number } }>(
      `/notification/workspaces/${workspaceId}/notifications`,
      { params: opts },
    ),
  unreadCount: (workspaceId: string) =>
    api.get<{ data: { count: number } }>(`/notification/workspaces/${workspaceId}/notifications/unread-count`),
  markRead: (workspaceId: string, id: string) =>
    api.post<{ data: { notification: Notification } }>(
      `/notification/workspaces/${workspaceId}/notifications/${id}/read`,
    ),
  markAllRead: (workspaceId: string) =>
    api.post<{ data: { marked: number } }>(`/notification/workspaces/${workspaceId}/notifications/read-all`),

  /** Path for the SSE stream — consumed via fetch + ReadableStream (EventSource lacks Authorization header support). */
  streamPath: (workspaceId: string) => `/api/v1/notification/workspaces/${workspaceId}/stream`,
};
