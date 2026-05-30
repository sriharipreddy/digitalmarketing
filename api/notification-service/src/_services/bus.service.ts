import { EventEmitter } from 'node:events';

export interface BusEvent {
  workspace_id: string;
  /** When null, broadcast to all subscribers in the workspace. */
  user_id: string | null;
  notification: Record<string, unknown>;
}

/**
 * In-process pub/sub. SSE connections subscribe to a workspace and (optionally)
 * a user; publishing routes events to matching listeners.
 *
 * Production scale: replace with a Redis Pub/Sub adapter so multiple
 * notification-service replicas can fan out to clients connected anywhere.
 */
export class NotificationBus extends EventEmitter {
  constructor() {
    super();
    // Default limit is 10 — for SSE we expect many concurrent subscribers per workspace.
    this.setMaxListeners(10_000);
  }

  publish(event: BusEvent): void {
    // 1. Targeted user delivery (if specified)
    if (event.user_id) {
      this.emit(channel(event.workspace_id, event.user_id), event.notification);
    }
    // 2. Workspace-wide broadcast (always fires, picks up wildcard subscribers)
    this.emit(channel(event.workspace_id, '*'), event.notification);
  }

  subscribe(workspace_id: string, user_id: string, handler: (n: Record<string, unknown>) => void): () => void {
    const userChannel = channel(workspace_id, user_id);
    const wildcardChannel = channel(workspace_id, '*');
    this.on(userChannel, handler);
    this.on(wildcardChannel, handler);
    return () => {
      this.off(userChannel, handler);
      this.off(wildcardChannel, handler);
    };
  }
}

function channel(workspaceId: string, userOrWildcard: string): string {
  return `notif:${workspaceId}:${userOrWildcard}`;
}
