import { DataTypes, Model, type Sequelize } from 'sequelize';

export type EmailEventKind =
  | 'delivered'
  | 'open'
  | 'click'
  | 'bounce'
  | 'dropped'
  | 'spamreport'
  | 'unsubscribe'
  | 'group_unsubscribe'
  | 'deferred'
  | 'processed';

export class EmailEvent extends Model {
  declare id: string;
  declare workspace_id: string | null;
  declare send_id: string | null;
  declare contact_email: string;
  declare kind: EmailEventKind;
  declare url: string | null;
  declare reason: string | null;
  declare sg_message_id: string | null;
  declare sg_event_id: string | null;
  declare timestamp: Date;
  declare raw: Record<string, unknown>;
  declare created_at: Date;
}

export function defineEmailEvent(sequelize: Sequelize) {
  EmailEvent.init(
    {
      id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      workspace_id: { type: DataTypes.CHAR(36), allowNull: true },
      send_id: { type: DataTypes.CHAR(36), allowNull: true },
      contact_email: { type: DataTypes.STRING(255), allowNull: false },
      kind: {
        type: DataTypes.ENUM(
          'delivered',
          'open',
          'click',
          'bounce',
          'dropped',
          'spamreport',
          'unsubscribe',
          'group_unsubscribe',
          'deferred',
          'processed',
        ),
        allowNull: false,
      },
      url: { type: DataTypes.STRING(2000), allowNull: true },
      reason: { type: DataTypes.STRING(500), allowNull: true },
      sg_message_id: { type: DataTypes.STRING(255), allowNull: true },
      sg_event_id: { type: DataTypes.STRING(255), allowNull: true },
      timestamp: { type: DataTypes.DATE, allowNull: false },
      raw: { type: DataTypes.JSON, allowNull: false },
    },
    {
      sequelize,
      modelName: 'EmailEvent',
      tableName: 'email_events',
      timestamps: true,
      updatedAt: false,
      underscored: true,
      indexes: [
        { name: 'idx_workspace_kind', fields: ['workspace_id', 'kind'] },
        { name: 'idx_send_kind', fields: ['send_id', 'kind'] },
        { name: 'idx_email', fields: ['contact_email'] },
        { name: 'uk_sg_event', unique: true, fields: ['sg_event_id'] },
      ],
    },
  );
  return EmailEvent;
}
