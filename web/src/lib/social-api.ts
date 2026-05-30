import { api } from './api';

export type SocialPlatform = 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'tiktok' | 'youtube';
export type AccountStatus = 'connected' | 'expired' | 'revoked' | 'error';
export type PostStatus = 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed' | 'cancelled';

export interface SocialAccount {
  id: string;
  workspace_id: string;
  platform: SocialPlatform;
  external_id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  status: AccountStatus;
  scopes: string[] | null;
  last_error: string | null;
  created_at: string;
}

export interface SocialPost {
  id: string;
  workspace_id: string;
  account_id: string;
  platform: SocialPlatform;
  content: string;
  media_urls: string[] | null;
  scheduled_at: string | null;
  published_at: string | null;
  external_post_id: string | null;
  external_url: string | null;
  status: PostStatus;
  error: string | null;
  created_at: string;
}

export const socialApi = {
  listAccounts: (workspaceId: string) =>
    api.get<{ data: { accounts: SocialAccount[] } }>(
      `/social/workspaces/${workspaceId}/accounts`,
    ),
  startConnect: (workspaceId: string, platform: SocialPlatform, redirectUri: string) =>
    api.post<{ data: { authorize_url: string; state: string } }>(
      `/social/workspaces/${workspaceId}/accounts/connect/start`,
      { platform, redirect_uri: redirectUri },
    ),
  finishConnect: (workspaceId: string, body: { platform: SocialPlatform; code: string; state: string }) =>
    api.post<{ data: { account: SocialAccount } }>(
      `/social/workspaces/${workspaceId}/accounts/connect/finish`,
      body,
    ),
  disconnect: (workspaceId: string, accountId: string) =>
    api.delete<{ data: { id: string; removed: boolean } }>(
      `/social/workspaces/${workspaceId}/accounts/${accountId}`,
    ),

  listPosts: (workspaceId: string, opts?: { status?: string; limit?: number; offset?: number }) =>
    api.get<{ data: { rows: SocialPost[]; total: number } }>(
      `/social/workspaces/${workspaceId}/posts`,
      { params: opts },
    ),
  createPost: (
    workspaceId: string,
    body: {
      account_id: string;
      content: string;
      media_urls?: string[];
      scheduled_at?: string | null;
    },
  ) =>
    api.post<{ data: { post: SocialPost } }>(
      `/social/workspaces/${workspaceId}/posts`,
      body,
    ),
  publishPost: (workspaceId: string, postId: string) =>
    api.post<{ data: { post: SocialPost } }>(
      `/social/workspaces/${workspaceId}/posts/${postId}/publish`,
    ),
  removePost: (workspaceId: string, postId: string) =>
    api.delete<{ data: { id: string; removed: boolean } }>(
      `/social/workspaces/${workspaceId}/posts/${postId}`,
    ),
};
