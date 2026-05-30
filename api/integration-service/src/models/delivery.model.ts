import { DataTypes, Model, type Sequelize } from 'sequelize';
import type { Webhook } from './webhook.model.js';

export type DeliveryStatus = 'pending' | 'in_flight' | 'succeeded' | 'failed' | 'dead_letter';

export class WebhookDelivery extends Model {
  declare id: string;
  declare workspace_id: string;
  declare webhook_id: string;
  declare event_id: string;          // The originating event UUID
  declare event_kind: string;
  declare payload: Record<string, unknown>;
  declare status: DeliveryStatus;
  declare attempts: number;
  declare last_attempt_at: Date | null;
  declare next_attempt_at: Date | null;
  declare response_status: number | null;
  declare response_body: string | null;
  declare error: string | null;
  declare delivered_at: Date | null;
  declare created_at: Date;
  declare updated_at: Date;
}

export function defineWebhookDelivery(sequelize: Sequelize, models: { Webhook: typeof Webhook }) {
  WebhookDelivery.init(
    {
      id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      workspace_id: { type: DataTypes.CHAR(36), allowNull: false },
      webhook_id: {
        type: DataTypes.CHAR(36),
        allowNull: false,
        references: { model: models.Webhook, key: 'id' },
      },
      event_id: { type: DataTypes.CHAR(36), allowNull: false },
      event_kind: { type: DataTypes.STRING(64), allowNull: false },
      payload: { type: DataTypes.JSON, allowNull: false },
      status: {
        type: DataTypes.ENUM('pending', 'in_flight', 'succeeded', 'failed', 'dead_letter'),
        allowNull: false,
        defaultValue: 'pending',
      },
      attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      last_attempt_at: { type: DataTypes.DATE, allowNull: true },
      next_attempt_at: { type: DataTypes.DATE, allowNull: true },
      response_status: { type: DataTypes.INTEGER, allowNull: true },
      response_body: { type: DataTypes.STRING(2000), allowNull: true },
      error: { type: DataTypes.STRING(2000), allowNull: true },
      delivered_at: { type: DataTypes.DATE, allowNull: true },
    },
    {
      sequelize,
      modelName: 'WebhookDelivery',
      tableName: 'integration_webhook_deliveries',
      timestamps: true,
      underscored: true,
      indexes: [
        { name: 'uk_webhook_event', unique: true, fields: ['webhook_id', 'event_id'] },
        { name: 'idx_status_next', fields: ['status', 'next_attempt_at'] },
        { name: 'idx_workspace_created', fields: ['workspace_id', 'created_at'] },
      ],
    },
  );
  return WebhookDelivery;
}
