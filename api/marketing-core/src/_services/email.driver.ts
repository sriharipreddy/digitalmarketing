import sgMail from '@sendgrid/mail';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailDriver {
  send(msg: EmailMessage): Promise<void>;
}

export class SendGridDriver implements EmailDriver {
  constructor(
    apiKey: string,
    private from: { email: string; name: string },
  ) {
    sgMail.setApiKey(apiKey);
  }

  async send(msg: EmailMessage): Promise<void> {
    await sgMail.send({
      to: msg.to,
      from: this.from,
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
    });
  }
}

export class StubEmailDriver implements EmailDriver {
  constructor(private logger: { info: (obj: unknown, msg?: string) => void }) {}
  async send(msg: EmailMessage): Promise<void> {
    this.logger.info(
      { to: msg.to, subject: msg.subject, body_preview: msg.text.slice(0, 240) },
      'email_stubbed',
    );
  }
}
