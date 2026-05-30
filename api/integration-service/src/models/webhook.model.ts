import { DataTypes, Model, type Sequelize } from 'sequelize';

export type WebhookStatus = 'active' | 'paused' | 'disabled';

export class Webhook extends Model {
  declare id: string;
  declare workspace_id: string;
  declare name: string;
  declare target_url: string;
  declare secret: string;          // HMAC signing secret given to the customer
  declare event_kinds: string[];   // e.g. ['campaign.completed', 'commission.paid', '*']
  declare status: WebhookStatus;
  declare last_delivery_at: Date | null;
  declare consecutive_failures: number;
  declare created_by: string;
  declare created_at: Date;
  declare updated_at: Date;
}

export function defineWebhook(sequelize: Sequelize) {
  Webhook.init(
    {
      id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      workspace_id: { type: DataTypes.CHAR(36), allowNull: false },
      name: { type: DataTypes.STRING(255), allowNull: false },
      target_url: { type: DataTypes.STRING(2000), allowNull: false },
      secret: { type: DataTypes.STRING(255), allowNull: false },
      event_kinds: { type: DataTypes.JSON, allowNull: false },
      status: {
        type: DataTypes.ENUM('active', 'paused', 'disabled'),
        allowNull: false,
        defaultValue: 'active',
      },
      last_delivery_at: { type: DataTypes.DATE, allowNull: true },
      consecutive_failures: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      created_by: { type: DataTypes.CHAR(36), allowNull: false },
    },
    {
      sequelize,
      modelName: 'Webhook',
      tableName: 'integration_webhooks',
      timestamps: true,
      underscored: true,
      indexes: [
        { name: 'idx_workspace_status', fields: ['workspace_id', 'status'] },
      ],
    },
  );
  return Webhook;
}
