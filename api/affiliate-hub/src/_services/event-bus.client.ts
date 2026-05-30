import crypto from 'node:crypto';
import axios, { type AxiosInstance } from 'axios';

/**
 * Posts business events to integration-service so they can fan out to
 * customer-subscribed webhooks. Fire-and-forget; same HMAC scheme as the
 * notification client.
 */
export class EventBusClient {
  private http: AxiosInstance | null;

  constructor(
    baseUrl: string,
    private sharedSecret: string,
    private logger: { warn: (obj: unknown, msg?: string) => void },
  ) {
    if (!baseUrl || !sharedSecret) {
      this.http = null;
      return;
    }
    this.http = axios.create({ baseURL: baseUrl, timeout: 5_000 });
  }

  async publish(event: {
    workspace_id: string;
    kind: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    if (!this.http) return;
    const body = { ...event, event_id: crypto.randomUUID() };
    const bodyStr = JSON.stringify(body);
    const ts = Math.floor(Date.now() / 1000).toString();
    const sig = crypto.createHmac('sha256', this.sharedSecret).update(`${ts}.${bodyStr}`).digest('hex');
    try {
      await this.http.post('/api/v1/integration/internal/events', body, {
        headers: {
          'Content-Type': 'application/json',
          'X-Notif-Timestamp': ts,
          'X-Notif-Signature': sig,
        },
      });
    } catch (err: any) {
      this.logger.warn({ err: err.message }, 'event_publish_failed');
    }
  }
}
