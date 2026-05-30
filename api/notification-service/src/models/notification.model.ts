import { DataTypes, Model, type Sequelize } from 'sequelize';

export type NotificationKind =
  | 'campaign.completed'
  | 'campaign.failed'
  | 'email.bounced'
  | 'email.unsubscribed'
  | 'social.post_published'
  | 'social.post_failed'
  | 'member.invited'
  | 'member.joined'
  | 'billing.payment_failed'
  | 'billing.subscription_upgraded'
  | 'commission.recorded'
  | 'commission.paid'
  | 'autopilot.recommendation'
  | 'system.alert'
  | 'custom';

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error';

export class Notification extends Model {
  declare id: string;
  declare workspace_id: string;
  declare /** Recipient user — null = broadcast to entire workspace */ user_id: string | null;
  declare kind: NotificationKind;
  declare severity: NotificationSeverity;
  declare title: string;
  declare body: string | null;
  declare action_url: string | null;
  declare metadata: Record<string, unknown> | null;
  declare read_at: Date | null;
  declare /** Service that published this. */ from_service: string;
  declare created_at: Date;
}

export function defineNotification(sequelize: Sequelize) {
  Notification.init(
    {
      id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      workspace_id: { type: DataTypes.CHAR(36), allowNull: false },
      user_id: { type: DataTypes.CHAR(36), allowNull: true },
      kind: {
        type: DataTypes.ENUM(
          'campaign.completed',
          'campaign.failed',
          'email.bounced',
          'email.unsubscribed',
          'social.post_published',
          'social.post_failed',
          'member.invited',
          'member.joined',
          'billing.payment_failed',
          'billing.subscription_upgraded',
          'commission.recorded',
          'commission.paid',
          'autopilot.recommendation',
          'system.alert',
          'custom',
        ),
        allowNull: false,
      },
      severity: {
        type: DataTypes.ENUM('info', 'success', 'warning', 'error'),
        allowNull: false,
        defaultValue: 'info',
      },
      title: { type: DataTypes.STRING(500), allowNull: false },
      body: { type: DataTypes.STRING(2000), allowNull: true },
      action_url: { type: DataTypes.STRING(2000), allowNull: true },
      metadata: { type: DataTypes.JSON, allowNull: true },
      read_at: { type: DataTypes.DATE, allowNull: true },
      from_service: { type: DataTypes.STRING(64), allowNull: false },
    },
    {
      sequelize,
      modelName: 'Notification',
      tableName: 'notif_notifications',
      timestamps: true,
      updatedAt: false,
      underscored: true,
      indexes: [
        { name: 'idx_workspace_user_read', fields: ['workspace_id', 'user_id', 'read_at'] },
        { name: 'idx_workspace_created', fields: ['workspace_id', 'created_at'] },
        { name: 'idx_kind', fields: ['workspace_id', 'kind'] },
      ],
    },
  );
  return Notification;
}
