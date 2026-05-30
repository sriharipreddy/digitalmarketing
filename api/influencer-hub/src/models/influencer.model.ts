import { DataTypes, Model, type Sequelize } from 'sequelize';

export type InfluencerPlatform = 'instagram' | 'tiktok' | 'youtube' | 'twitter' | 'linkedin';
export type InfluencerStatus = 'discovered' | 'shortlisted' | 'contacted' | 'negotiating' | 'contracted' | 'declined' | 'paused';

export class Influencer extends Model {
  declare id: string;
  declare workspace_id: string;
  declare platform: InfluencerPlatform;
  declare handle: string;
  declare display_name: string | null;
  declare avatar_url: string | null;
  declare bio: string | null;
  declare followers: number;
  declare engagement_rate: number; // 0..1
  declare audience_country: string | null;
  declare topics: string[] | null;
  declare estimated_cost_usd: number | null;
  declare status: InfluencerStatus;
  declare notes: string | null;
  declare last_contacted_at: Date | null;
  declare external_id: string | null;
  declare created_by: string;
  declare created_at: Date;
  declare updated_at: Date;
}

export function defineInfluencer(sequelize: Sequelize) {
  Influencer.init(
    {
      id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      workspace_id: { type: DataTypes.CHAR(36), allowNull: false },
      platform: {
        type: DataTypes.ENUM('instagram', 'tiktok', 'youtube', 'twitter', 'linkedin'),
        allowNull: false,
      },
      handle: { type: DataTypes.STRING(100), allowNull: false },
      display_name: { type: DataTypes.STRING(255), allowNull: true },
      avatar_url: { type: DataTypes.STRING(500), allowNull: true },
      bio: { type: DataTypes.STRING(2000), allowNull: true },
      followers: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      engagement_rate: { type: DataTypes.DECIMAL(6, 4), allowNull: false, defaultValue: 0 },
      audience_country: { type: DataTypes.CHAR(2), allowNull: true },
      topics: { type: DataTypes.JSON, allowNull: true },
      estimated_cost_usd: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      status: {
        type: DataTypes.ENUM('discovered', 'shortlisted', 'contacted', 'negotiating', 'contracted', 'declined', 'paused'),
        allowNull: false,
        defaultValue: 'discovered',
      },
      notes: { type: DataTypes.TEXT, allowNull: true },
      last_contacted_at: { type: DataTypes.DATE, allowNull: true },
      external_id: { type: DataTypes.STRING(255), allowNull: true },
      created_by: { type: DataTypes.CHAR(36), allowNull: false },
    },
    {
      sequelize,
      modelName: 'Influencer',
      tableName: 'influencer_profiles',
      timestamps: true,
      underscored: true,
      indexes: [
        { name: 'uk_workspace_platform_handle', unique: true, fields: ['workspace_id', 'platform', 'handle'] },
        { name: 'idx_workspace_status', fields: ['workspace_id', 'status'] },
        { name: 'idx_followers', fields: ['followers'] },
      ],
    },
  );
  return Influencer;
}
