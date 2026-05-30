import { DataTypes, Model, type Sequelize } from 'sequelize';
import type { Campaign } from './campaign.model.js';

export type ChannelKind = 'email' | 'sms' | 'push' | 'facebook' | 'instagram' | 'linkedin' | 'twitter' | 'tiktok' | 'google_ads';
export type ChannelStatus = 'pending' | 'queued' | 'sent' | 'failed' | 'skipped';

export class CampaignChannel extends Model {
  declare id: string;
  declare campaign_id: string;
  declare kind: ChannelKind;
  declare status: ChannelStatus;
  declare config: Record<string, unknown>;
  declare external_id: string | null;
  declare error: string | null;
  declare sent_at: Date | null;
  declare created_at: Date;
  declare updated_at: Date;
}

export function defineCampaignChannel(sequelize: Sequelize, models: { Campaign: typeof Campaign }) {
  CampaignChannel.init(
    {
      id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      campaign_id: {
        type: DataTypes.CHAR(36),
        allowNull: false,
        references: { model: models.Campaign, key: 'id' },
      },
      kind: {
        type: DataTypes.ENUM('email', 'sms', 'push', 'facebook', 'instagram', 'linkedin', 'twitter', 'tiktok', 'google_ads'),
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM('pending', 'queued', 'sent', 'failed', 'skipped'),
        allowNull: false,
        defaultValue: 'pending',
      },
      config: { type: DataTypes.JSON, allowNull: false },
      external_id: { type: DataTypes.STRING(255), allowNull: true },
      error: { type: DataTypes.STRING(2000), allowNull: true },
      sent_at: { type: DataTypes.DATE, allowNull: true },
    },
    {
      sequelize,
      modelName: 'CampaignChannel',
      tableName: 'campaign_channels',
      timestamps: true,
      underscored: true,
      indexes: [
        { name: 'idx_campaign', fields: ['campaign_id'] },
        { name: 'idx_status', fields: ['status'] },
      ],
    },
  );
  return CampaignChannel;
}
