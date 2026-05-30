import sgMail from '@sendgrid/mail';

export interface BulkSendInput {
  from: { email: string; name: string };
  subject: string;
  html: string;
  text: string;
  recipients: string[];
  // SendGrid sandbox mode returns success without delivering.
  sandbox?: boolean;
}

export interface BulkSendResult {
  sent: number;
  failed: number;
  errors?: Array<{ email: string; error: string }>;
}

export interface EmailDriver {
  /** Real or stubbed bulk send. Implementations should batch + handle partial failures. */
  sendBulk(input: BulkSendInput): Promise<BulkSendResult>;
}

/**
 * Sends via SendGrid's /v3/mail/send using BCC-less personalisation
 * — each recipient gets their own `to` so opens/clicks attribute correctly.
 */
export class SendGridDriver implements EmailDriver {
  constructor(
    apiKey: string,
    private batchSize: number,
  ) {
    sgMail.setApiKey(apiKey);
  }

  async sendBulk(input: BulkSendInput): Promise<BulkSendResult> {
    let sent = 0;
    let failed = 0;
    const errors: Array<{ email: string; error: string }> = [];

    for (let i = 0; i < input.recipients.length; i += this.batchSize) {
      const batch = input.recipients.slice(i, i + this.batchSize);
      try {
        // SendGrid lets us pass up to 1000 personalizations per request — each
        // gets its own `to` so tracking is per-recipient. Sandbox honoured.
        const personalizations = batch.map((to) => ({ to: [{ email: to }] }));
        await sgMail.send({
          from: input.from,
          subject: input.subject,
          text: input.text,
          html: input.html,
          personalizations,
          mailSettings: input.sandbox ? { sandboxMode: { enable: true } } : undefined,
          trackingSettings: {
            openTracking: { enable: true },
            clickTracking: { enable: true, enableText: false },
            subscriptionTracking: { enable: false },
          },
        });
        sent += batch.length;
      } catch (err: any) {
        failed += batch.length;
        const msg = err?.response?.body?.errors?.[0]?.message ?? err.message ?? 'unknown';
        for (const to of batch) errors.push({ email: to, error: msg });
      }
    }
    return { sent, failed, errors: errors.length ? errors : undefined };
  }
}

/** Stub — logs the send instead of mailing. Used until SendGrid is wired. */
export class StubEmailDriver implements EmailDriver {
  constructor(private logger: { info: (obj: unknown, msg?: string) => void }) {}

  async sendBulk(input: BulkSendInput): Promise<BulkSendResult> {
    this.logger.info(
      {
        from: input.from.email,
        subject: input.subject,
        recipient_count: input.recipients.length,
        sample: input.recipients.slice(0, 3),
      },
      'bulk_send_stubbed',
    );
    return { sent: input.recipients.length, failed: 0 };
  }
}
