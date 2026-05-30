import type { Models } from '../models/index.js';
import type { Channel } from '../models/messaging.model.js';
import type { MessagingDriver } from './messaging.drivers.js';
import { BadRequestError, ValidationError } from '@marketing/shared-middleware';

const STOP_KEYWORDS = new Set(['stop', 'stopall', 'unsubscribe', 'cancel', 'end', 'quit']);
const HELP_KEYWORDS = new Set(['help', 'info']);

export interface SendMessageInput {
  channel: Channel;
  to: string;
  body: string;
  from?: string | null;
  template_external_id?: string | null;
  metadata?: Record<string, unknown> | null;
  /** Caller's local time zone for TCPA quiet-hours enforcement (default: UTC). */
  recipient_timezone?: string;
}

export interface MessagingDrivers {
  sms: MessagingDriver;
  whatsapp: MessagingDriver;
  push: MessagingDriver;
}

export interface QuietHours {
  /** Hour-of-day (0-23) inclusive when sending is allowed to start. */
  start_hour: number;
  /** Hour-of-day (0-23) inclusive when sending must stop. */
  end_hour: number;
  /** Channels that must honour these hours. Email is exempt. */
  channels: Channel[];
}

export class MessagingService {
  constructor(
    private models: Models,
    private drivers: MessagingDrivers,
    private quietHours: QuietHours,
    private logger: { info: (o: unknown, m?: string) => void; warn: (o: unknown, m?: string) => void },
  ) {}

  /** Caller asks "is this address suppressed on this channel?" */
  async isSuppressed(workspaceId: string, channel: Channel, address: string): Promise<boolean> {
    const row = await this.models.MessagingSuppression.findOne({
      where: { workspace_id: workspaceId, channel, address },
    });
    return !!row;
  }

  /** Manually add a suppression (e.g. from STOP keyword webhook or DSAR). */
  async suppress(workspaceId: string, channel: Channel, address: string, reason: string) {
    const [row] = await this.models.MessagingSuppression.findOrCreate({
      where: { workspace_id: workspaceId, channel, address },
      defaults: { workspace_id: workspaceId, channel, address, reason, suppressed_at: new Date() } as any,
    });
    return row;
  }

  async unsuppress(workspaceId: string, channel: Channel, address: string) {
    await this.models.MessagingSuppression.destroy({
      where: { workspace_id: workspaceId, channel, address },
    });
  }

  /** Handle an inbound SMS — if it's a STOP keyword, suppress the sender. */
  async handleInbound(workspaceId: string, channel: Channel, fromAddress: string, body: string) {
    const norm = body.trim().toLowerCase();
    if (STOP_KEYWORDS.has(norm)) {
      await this.suppress(workspaceId, channel, fromAddress, `inbound:${norm}`);
      return { action: 'suppressed' as const, reply: 'You have been unsubscribed. Reply START to resume.' };
    }
    if (norm === 'start' || norm === 'unstop' || norm === 'subscribe') {
      await this.unsuppress(workspaceId, channel, fromAddress);
      return { action: 'unsuppressed' as const, reply: 'You are now resubscribed.' };
    }
    if (HELP_KEYWORDS.has(norm)) {
      return { action: 'help' as const, reply: 'Reply STOP to opt out. Msg & data rates may apply.' };
    }
    return { action: 'received' as const, reply: null };
  }

  /** Single-recipient send. Enforces suppression + quiet hours. */
  async send(workspaceId: string, input: SendMessageInput) {
    if (!input.to || input.to.length === 0) {
      throw new ValidationError('to is required', { to: ['Required'] });
    }
    if (!input.body || input.body.length === 0) {
      throw new ValidationError('body is required', { body: ['Required'] });
    }

    if (await this.isSuppressed(workspaceId, input.channel, input.to)) {
      throw new BadRequestError(`Address is suppressed on ${input.channel}`);
    }

    if (this.quietHours.channels.includes(input.channel)) {
      const tz = input.recipient_timezone ?? 'UTC';
      if (!this.isWithinSendingWindow(new Date(), tz)) {
        // Quiet hours: log + record as queued for later. In a real worker this
        // would defer to next allowed window; here we 4xx so callers can decide.
        throw new BadRequestError('Outside permitted sending window for recipient timezone');
      }
    }

    const driver = this.drivers[input.channel];
    if (!driver) throw new BadRequestError(`No driver configured for ${input.channel}`);

    const row = await this.models.Message.create({
      workspace_id: workspaceId,
      channel: input.channel,
      to_address: input.to,
      from_address: input.from ?? null,
      body: input.body,
      template_external_id: input.template_external_id ?? null,
      status: 'sending',
      metadata: input.metadata ?? null,
    } as any);

    try {
      const r = await driver.send({
        to: input.to,
        body: input.body,
        template_external_id: input.template_external_id ?? null,
        metadata: input.metadata ?? null,
      });
      if (r.ok) {
        await row.update({
          status: 'sent',
          provider_message_id: r.provider_message_id ?? null,
          sent_at: new Date(),
        });
      } else {
        await row.update({ status: 'failed', error: r.error ?? 'unknown' });
      }
    } catch (e: any) {
      await row.update({ status: 'failed', error: e.message ?? 'send_threw' });
    }
    return row;
  }

  async list(workspaceId: string, opts: { channel?: Channel; limit?: number }) {
    const where: any = { workspace_id: workspaceId };
    if (opts.channel) where.channel = opts.channel;
    return this.models.Message.findAll({
      where,
      order: [['created_at', 'DESC']],
      limit: opts.limit ?? 100,
    });
  }

  async listSuppressions(workspaceId: string, channel?: Channel) {
    const where: any = { workspace_id: workspaceId };
    if (channel) where.channel = channel;
    return this.models.MessagingSuppression.findAll({
      where,
      order: [['suppressed_at', 'DESC']],
    });
  }

  /** TCPA-aware quiet hours check. */
  private isWithinSendingWindow(now: Date, timezone: string): boolean {
    try {
      const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        hour12: false,
      });
      const parts = fmt.formatToParts(now);
      const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
      return hour >= this.quietHours.start_hour && hour < this.quietHours.end_hour;
    } catch (e: any) {
      this.logger.warn({ timezone, err: e.message }, 'invalid_timezone_defaulting_to_allow');
      return true;
    }
  }
}
