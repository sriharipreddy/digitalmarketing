import crypto from 'node:crypto';

export interface SendInput {
  to: string;
  body: string;
  template_external_id?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface SendResult {
  ok: boolean;
  provider_message_id?: string;
  error?: string;
}

export interface MessagingDriver {
  send(input: SendInput): Promise<SendResult>;
}

/** Twilio SMS driver — uses the real Twilio REST API in prod, stubbed in dev. */
export class TwilioSmsDriver implements MessagingDriver {
  constructor(
    private accountSid: string,
    private authToken: string,
    private fromNumber: string,
  ) {}

  async send(input: SendInput): Promise<SendResult> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(this.accountSid)}/Messages.json`;
    const body = new URLSearchParams({
      To: input.to,
      From: this.fromNumber,
      Body: input.body,
    });
    const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `twilio_${res.status}: ${errText.slice(0, 200)}` };
    }
    const j = (await res.json()) as { sid?: string };
    return { ok: true, provider_message_id: j.sid };
  }
}

/** 360dialog WhatsApp Business driver — Cloud API via D360. */
export class WhatsApp360Driver implements MessagingDriver {
  constructor(
    private apiKey: string,
    private baseUrl: string,
    private fromNumber: string,
  ) {}

  async send(input: SendInput): Promise<SendResult> {
    const url = `${this.baseUrl.replace(/\/$/, '')}/messages`;
    const payload: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      to: input.to,
      from: this.fromNumber,
    };
    if (input.template_external_id) {
      payload.type = 'template';
      payload.template = { name: input.template_external_id, language: { code: 'en' } };
    } else {
      payload.type = 'text';
      payload.text = { body: input.body };
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'D360-API-KEY': this.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `d360_${res.status}: ${errText.slice(0, 200)}` };
    }
    const j = (await res.json()) as { messages?: Array<{ id: string }> };
    return { ok: true, provider_message_id: j.messages?.[0]?.id };
  }
}

/** Firebase Cloud Messaging driver — server-key auth, single-device push. */
export class FcmPushDriver implements MessagingDriver {
  constructor(
    private serverKey: string,
    private endpoint: string,
  ) {}

  async send(input: SendInput): Promise<SendResult> {
    const payload = {
      to: input.to,
      notification: {
        title: (input.metadata?.title as string) ?? 'Notification',
        body: input.body,
      },
      data: input.metadata ?? {},
    };
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: { Authorization: `key=${this.serverKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `fcm_${res.status}: ${errText.slice(0, 200)}` };
    }
    const j = (await res.json()) as { message_id?: string };
    return { ok: true, provider_message_id: j.message_id };
  }
}

/** Stub — returns success without calling out. Default in dev. */
export class StubMessagingDriver implements MessagingDriver {
  constructor(
    private channel: string,
    private logger: { info: (obj: unknown, msg?: string) => void },
  ) {}

  async send(input: SendInput): Promise<SendResult> {
    const id = `stub-${this.channel}-${crypto.randomUUID()}`;
    this.logger.info({ channel: this.channel, to: input.to, body_preview: input.body.slice(0, 80) }, 'message_send_stubbed');
    return { ok: true, provider_message_id: id };
  }
}
