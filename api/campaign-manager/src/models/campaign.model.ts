import { DataTypes, Model, type Sequelize } from 'sequelize';

export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'completed' | 'paused' | 'cancelled';
export type CampaignKind = 'email' | 'social' | 'multi_channel' | 'one_click';

export class Campaign extends Model {
  declare id: string;
  declare workspace_id: string;
  declare name: string;
  declare description: string | null;
  declare kind: CampaignKind;
  declare status: CampaignStatus;
  declare goal: string | null;
  declare scheduled_at: Date | null;
  declare started_at: Date | null;
  declare completed_at: Date | null;
  declare metrics: Record<string, unknown> | null;
  declare created_by: string;
  declare created_at: Date;
  declare updated_at: Date;
}

export function defineCampaign(sequelize: Sequelize) {
  Campaign.init(
    {
      id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      workspace_id: { type: DataTypes.CHAR(36), allowNull: false },
      name: { type: DataTypes.STRING(255), allowNull: false },
      description: { type: DataTypes.STRING(1000), allowNull: true },
      kind: {
        type: DataTypes.ENUM('email', 'social', 'multi_channel', 'one_click'),
        allowNull: false,
        defaultValue: 'email',
      },
      status: {
        type: DataTypes.ENUM('draft', 'scheduled', 'sending', 'completed', 'paused', 'cancelled'),
        allowNull: false,
        defaultValue: 'draft',
      },
      goal: { type: DataTypes.STRING(255), allowNull: true },
      scheduled_at: { type: DataTypes.DATE, allowNull: true },
      started_at: { type: DataTypes.DATE, allowNull: true },
      completed_at: { type: DataTypes.DATE, allowNull: true },
      metrics: { type: DataTypes.JSON, allowNull: true },
      created_by: { type: DataTypes.CHAR(36), allowNull: false },
    },
    {
      sequelize,
      modelName: 'Campaign',
      tableName: 'campaign_campaigns',
      timestamps: true,
      underscored: true,
      indexes: [
        { name: 'idx_workspace_status', fields: ['workspace_id', 'status'] },
        { name: 'idx_scheduled', fields: ['scheduled_at'] },
      ],
    },
  );
  return Campaign;
}
