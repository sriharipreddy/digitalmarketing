import crypto from 'node:crypto';
import axios, { type AxiosInstance } from 'axios';

export interface PublishInput {
  workspace_id: string;
  user_id?: string | null;
  kind: string;
  severity?: 'info' | 'success' | 'warning' | 'error';
  title: string;
  body?: string;
  action_url?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Fire-and-forget client for notification-service.
 * Failures are swallowed (notifications are nice-to-have, not transactional).
 */
export class NotificationClient {
  private http: AxiosInstance | null;

  constructor(
    baseUrl: string,
    private sharedSecret: string,
    private fromService: string,
    private logger: { warn: (obj: unknown, msg?: string) => void },
  ) {
    if (!baseUrl || !sharedSecret) {
      this.http = null;
      return;
    }
    this.http = axios.create({ baseURL: baseUrl, timeout: 5_000 });
  }

  async publish(input: PublishInput): Promise<void> {
    if (!this.http) return; // disabled
    const body = { ...input, from_service: this.fromService };
    const bodyStr = JSON.stringify(body);
    const ts = Math.floor(Date.now() / 1000).toString();
    const sig = crypto.createHmac('sha256', this.sharedSecret).update(`${ts}.${bodyStr}`).digest('hex');
    try {
      await this.http.post('/api/v1/notification/internal/publish', body, {
        headers: {
          'Content-Type': 'application/json',
          'X-Notif-Timestamp': ts,
          'X-Notif-Signature': sig,
        },
      });
    } catch (err: any) {
      this.logger.warn({ err: err.message }, 'notification_publish_failed');
    }
  }
}
