import { DataTypes, Model, type Sequelize } from 'sequelize';

export type AppPlatform = 'ios' | 'android';

export class AppListing extends Model {
  declare id: string;
  declare workspace_id: string;
  declare platform: AppPlatform;
  declare app_external_id: string;
  declare app_name: string;
  declare developer_name: string | null;
  declare category: string | null;
  declare current_version: string | null;
  declare rating_average: number | null;
  declare rating_count: number | null;
  declare keywords: string[] | null;
  declare description_short: string | null;
  declare description_full: string | null;
  declare last_sync_at: Date | null;
  declare created_at: Date;
  declare updated_at: Date;
}

export function defineAppListing(sequelize: Sequelize) {
  AppListing.init(
    {
      id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      workspace_id: { type: DataTypes.CHAR(36), allowNull: false },
      platform: { type: DataTypes.ENUM('ios', 'android'), allowNull: false },
      app_external_id: { type: DataTypes.STRING(255), allowNull: false },
      app_name: { type: DataTypes.STRING(255), allowNull: false },
      developer_name: { type: DataTypes.STRING(255), allowNull: true },
      category: { type: DataTypes.STRING(120), allowNull: true },
      current_version: { type: DataTypes.STRING(64), allowNull: true },
      rating_average: { type: DataTypes.DECIMAL(3, 2), allowNull: true },
      rating_count: { type: DataTypes.INTEGER, allowNull: true },
      keywords: { type: DataTypes.JSON, allowNull: true },
      description_short: { type: DataTypes.STRING(500), allowNull: true },
      description_full: { type: DataTypes.TEXT, allowNull: true },
      last_sync_at: { type: DataTypes.DATE, allowNull: true },
    },
    {
      sequelize,
      modelName: 'AppListing',
      tableName: 'seo_app_listings',
      timestamps: true,
      underscored: true,
      indexes: [
        { name: 'uk_workspace_platform_app', unique: true, fields: ['workspace_id', 'platform', 'app_external_id'] },
      ],
    },
  );
  return AppListing;
}
