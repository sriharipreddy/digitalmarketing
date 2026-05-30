import { DataTypes, Model, type Sequelize } from 'sequelize';

export type SendStatus = 'queued' | 'sending' | 'completed' | 'failed' | 'partial';

export class EmailSend extends Model {
  declare id: string;
  declare workspace_id: string;
  declare list_id: string | null;
  declare campaign_external_id: string | null;
  declare subject: string;
  declare from_email: string;
  declare from_name: string;
  declare status: SendStatus;
  declare audience_size: number;
  declare sent_count: number;
  declare failed_count: number;
  declare opens: number;
  declare clicks: number;
  declare bounces: number;
  declare unsubscribes: number;
  declare error: string | null;
  declare created_at: Date;
  declare updated_at: Date;
}

export function defineEmailSend(sequelize: Sequelize) {
  EmailSend.init(
    {
      id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      workspace_id: { type: DataTypes.CHAR(36), allowNull: false },
      list_id: { type: DataTypes.CHAR(36), allowNull: true },
      campaign_external_id: { type: DataTypes.STRING(64), allowNull: true },
      subject: { type: DataTypes.STRING(998), allowNull: false },
      from_email: { type: DataTypes.STRING(255), allowNull: false },
      from_name: { type: DataTypes.STRING(255), allowNull: false },
      status: {
        type: DataTypes.ENUM('queued', 'sending', 'completed', 'failed', 'partial'),
        allowNull: false,
        defaultValue: 'queued',
      },
      audience_size: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      sent_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      failed_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      opens: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      clicks: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      bounces: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      unsubscribes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      error: { type: DataTypes.STRING(2000), allowNull: true },
    },
    {
      sequelize,
      modelName: 'EmailSend',
      tableName: 'email_sends',
      timestamps: true,
      underscored: true,
      indexes: [
        { name: 'idx_workspace_created', fields: ['workspace_id', 'created_at'] },
        { name: 'idx_status', fields: ['status'] },
        { name: 'idx_campaign_external', fields: ['campaign_external_id'] },
      ],
    },
  );
  return EmailSend;
}
