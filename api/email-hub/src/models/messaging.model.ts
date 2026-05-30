import { DataTypes, Model, type Sequelize } from 'sequelize';

export type Channel = 'sms' | 'whatsapp' | 'push';
export type MessageStatus = 'queued' | 'sending' | 'sent' | 'failed' | 'delivered' | 'bounced';

/**
 * Unified message-send row. One row per individual message (one SMS = one row).
 * Email keeps its own `email_sends` table because its lifecycle (opens, clicks,
 * unsubscribes) is richer and tracked at the recipient level by SendGrid webhooks.
 */
export class Message extends Model {
  declare id: string;
  declare workspace_id: string;
  declare channel: Channel;
  declare to_address: string;
  declare from_address: string | null;
  declare body: string;
  declare template_external_id: string | null;
  declare status: MessageStatus;
  declare provider_message_id: string | null;
  declare error: string | null;
  declare sent_at: Date | null;
  declare delivered_at: Date | null;
  declare metadata: Record<string, unknown> | null;
  declare created_at: Date;
  declare updated_at: Date;
}

export function defineMessage(sequelize: Sequelize) {
  Message.init(
    {
      id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      workspace_id: { type: DataTypes.CHAR(36), allowNull: false },
      channel: { type: DataTypes.ENUM('sms', 'whatsapp', 'push'), allowNull: false },
      to_address: { type: DataTypes.STRING(255), allowNull: false },
      from_address: { type: DataTypes.STRING(255), allowNull: true },
      body: { type: DataTypes.TEXT, allowNull: false },
      template_external_id: { type: DataTypes.STRING(255), allowNull: true },
      status: {
        type: DataTypes.ENUM('queued', 'sending', 'sent', 'failed', 'delivered', 'bounced'),
        allowNull: false,
        defaultValue: 'queued',
      },
      provider_message_id: { type: DataTypes.STRING(255), allowNull: true },
      error: { type: DataTypes.STRING(2000), allowNull: true },
      sent_at: { type: DataTypes.DATE, allowNull: true },
      delivered_at: { type: DataTypes.DATE, allowNull: true },
      metadata: { type: DataTypes.JSON, allowNull: true },
    },
    {
      sequelize,
      modelName: 'Message',
      tableName: 'messaging_sends',
      timestamps: true,
      underscored: true,
      indexes: [
        { name: 'idx_workspace_channel_created', fields: ['workspace_id', 'channel', 'created_at'] },
        { name: 'idx_status', fields: ['status'] },
      ],
    },
  );
  return Message;
}

/**
 * Suppression list — once an address opts out of a channel (STOP keyword, push
 * unregistration, WhatsApp opt-out), no more messages may be sent. TCPA + GDPR.
 */
export class MessagingSuppression extends Model {
  declare id: string;
  declare workspace_id: string;
  declare channel: Channel;
  declare address: string;
  declare reason: string | null;
  declare suppressed_at: Date;
  declare created_at: Date;
  declare updated_at: Date;
}

export function defineMessagingSuppression(sequelize: Sequelize) {
  MessagingSuppression.init(
    {
      id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      workspace_id: { type: DataTypes.CHAR(36), allowNull: false },
      channel: { type: DataTypes.ENUM('sms', 'whatsapp', 'push'), allowNull: false },
      address: { type: DataTypes.STRING(255), allowNull: false },
      reason: { type: DataTypes.STRING(500), allowNull: true },
      suppressed_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      modelName: 'MessagingSuppression',
      tableName: 'messaging_suppressions',
      timestamps: true,
      underscored: true,
      indexes: [
        { name: 'uk_workspace_channel_address', unique: true, fields: ['workspace_id', 'channel', 'address'] },
      ],
    },
  );
  return MessagingSuppression;
}
