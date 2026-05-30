import { DataTypes, Model, type Sequelize } from 'sequelize';
import type { Affiliate } from './affiliate.model.js';

export class TrackingLink extends Model {
  declare id: string;
  declare workspace_id: string;
  declare affiliate_id: string;
  declare short_code: string;
  declare destination_url: string;
  declare click_count: number;
  declare conversion_count: number;
  declare label: string | null;
  declare created_at: Date;
}

export function defineTrackingLink(sequelize: Sequelize, models: { Affiliate: typeof Affiliate }) {
  TrackingLink.init(
    {
      id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      workspace_id: { type: DataTypes.CHAR(36), allowNull: false },
      affiliate_id: {
        type: DataTypes.CHAR(36),
        allowNull: false,
        references: { model: models.Affiliate, key: 'id' },
      },
      short_code: { type: DataTypes.STRING(16), allowNull: false },
      destination_url: { type: DataTypes.STRING(2000), allowNull: false },
      click_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      conversion_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      label: { type: DataTypes.STRING(255), allowNull: true },
    },
    {
      sequelize,
      modelName: 'TrackingLink',
      tableName: 'affiliate_tracking_links',
      timestamps: true,
      updatedAt: false,
      underscored: true,
      indexes: [
        { name: 'uk_short_code', unique: true, fields: ['short_code'] },
        { name: 'idx_workspace_affiliate', fields: ['workspace_id', 'affiliate_id'] },
      ],
    },
  );
  return TrackingLink;
}
