import { DataTypes, Model, type Sequelize } from 'sequelize';
import type { SocialAccount, SocialPlatform } from './account.model.js';

export type PostStatus = 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed' | 'cancelled';

export class SocialPost extends Model {
  declare id: string;
  declare workspace_id: string;
  declare account_id: string;
  declare platform: SocialPlatform;
  declare content: string;
  declare media_urls: string[] | null;
  declare scheduled_at: Date | null;
  declare published_at: Date | null;
  declare external_post_id: string | null;
  declare external_url: string | null;
  declare status: PostStatus;
  declare error: string | null;
  declare metrics: Record<string, number> | null;
  declare campaign_external_id: string | null;
  declare created_by: string;
  declare created_at: Date;
  declare updated_at: Date;
}

export function defineSocialPost(sequelize: Sequelize, models: { SocialAccount: typeof SocialAccount }) {
  SocialPost.init(
    {
      id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      workspace_id: { type: DataTypes.CHAR(36), allowNull: false },
      account_id: {
        type: DataTypes.CHAR(36),
        allowNull: false,
        references: { model: models.SocialAccount, key: 'id' },
      },
      platform: {
        type: DataTypes.ENUM('facebook', 'instagram', 'twitter', 'linkedin', 'tiktok', 'youtube'),
        allowNull: false,
      },
      content: { type: DataTypes.TEXT, allowNull: false },
      media_urls: { type: DataTypes.JSON, allowNull: true },
      scheduled_at: { type: DataTypes.DATE, allowNull: true },
      published_at: { type: DataTypes.DATE, allowNull: true },
      external_post_id: { type: DataTypes.STRING(255), allowNull: true },
      external_url: { type: DataTypes.STRING(500), allowNull: true },
      status: {
        type: DataTypes.ENUM('draft', 'scheduled', 'publishing', 'published', 'failed', 'cancelled'),
        allowNull: false,
        defaultValue: 'draft',
      },
      error: { type: DataTypes.STRING(2000), allowNull: true },
      metrics: { type: DataTypes.JSON, allowNull: true },
      campaign_external_id: { type: DataTypes.STRING(64), allowNull: true },
      created_by: { type: DataTypes.CHAR(36), allowNull: false },
    },
    {
      sequelize,
      modelName: 'SocialPost',
      tableName: 'social_posts',
      timestamps: true,
      underscored: true,
      indexes: [
        { name: 'idx_workspace_status', fields: ['workspace_id', 'status'] },
        { name: 'idx_account', fields: ['account_id'] },
        { name: 'idx_scheduled', fields: ['scheduled_at'] },
      ],
    },
  );
  return SocialPost;
}
