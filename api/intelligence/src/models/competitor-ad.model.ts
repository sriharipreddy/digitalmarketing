import { DataTypes, Model, type Sequelize } from 'sequelize';
import type { Competitor } from './competitor.model.js';

export type AdPlatform = 'meta' | 'google' | 'linkedin' | 'tiktok';

export class CompetitorAd extends Model {
  declare id: string;
  declare workspace_id: string;
  declare competitor_id: string;
  declare platform: AdPlatform;
  declare external_id: string;
  declare creative_url: string | null;
  declare headline: string | null;
  declare body: string | null;
  declare landing_url: string | null;
  declare first_seen_at: Date | null;
  declare last_seen_at: Date | null;
  declare est_spend_usd: number | null;
  declare est_impressions: number | null;
  declare created_at: Date;
}

export function defineCompetitorAd(sequelize: Sequelize, models: { Competitor: typeof Competitor }) {
  CompetitorAd.init(
    {
      id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      workspace_id: { type: DataTypes.CHAR(36), allowNull: false },
      competitor_id: {
        type: DataTypes.CHAR(36),
        allowNull: false,
        references: { model: models.Competitor, key: 'id' },
      },
      platform: {
        type: DataTypes.ENUM('meta', 'google', 'linkedin', 'tiktok'),
        allowNull: false,
      },
      external_id: { type: DataTypes.STRING(255), allowNull: false },
      creative_url: { type: DataTypes.STRING(2000), allowNull: true },
      headline: { type: DataTypes.STRING(500), allowNull: true },
      body: { type: DataTypes.TEXT, allowNull: true },
      landing_url: { type: DataTypes.STRING(2000), allowNull: true },
      first_seen_at: { type: DataTypes.DATE, allowNull: true },
      last_seen_at: { type: DataTypes.DATE, allowNull: true },
      est_spend_usd: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      est_impressions: { type: DataTypes.BIGINT, allowNull: true },
    },
    {
      sequelize,
      modelName: 'CompetitorAd',
      tableName: 'intelligence_competitor_ads',
      timestamps: true,
      updatedAt: false,
      underscored: true,
      indexes: [
        { name: 'uk_external', unique: true, fields: ['platform', 'external_id'] },
        { name: 'idx_workspace_competitor', fields: ['workspace_id', 'competitor_id'] },
      ],
    },
  );
  return CompetitorAd;
}
