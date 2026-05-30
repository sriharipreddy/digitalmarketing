import { DataTypes, Model, type Sequelize } from 'sequelize';

export class UtmLink extends Model {
  declare id: string;
  declare workspace_id: string;
  declare campaign_id: string | null;
  declare short_code: string;
  declare destination_url: string;
  declare source: string;
  declare medium: string;
  declare campaign: string;
  declare term: string | null;
  declare content: string | null;
  declare click_count: number;
  declare created_by: string;
  declare created_at: Date;
}

export function defineUtmLink(sequelize: Sequelize) {
  UtmLink.init(
    {
      id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      workspace_id: { type: DataTypes.CHAR(36), allowNull: false },
      campaign_id: { type: DataTypes.CHAR(36), allowNull: true },
      short_code: { type: DataTypes.STRING(16), allowNull: false },
      destination_url: { type: DataTypes.STRING(2000), allowNull: false },
      source: { type: DataTypes.STRING(64), allowNull: false },
      medium: { type: DataTypes.STRING(64), allowNull: false },
      campaign: { type: DataTypes.STRING(255), allowNull: false },
      term: { type: DataTypes.STRING(255), allowNull: true },
      content: { type: DataTypes.STRING(255), allowNull: true },
      click_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      created_by: { type: DataTypes.CHAR(36), allowNull: false },
    },
    {
      sequelize,
      modelName: 'UtmLink',
      tableName: 'campaign_utm_links',
      timestamps: true,
      updatedAt: false,
      underscored: true,
      indexes: [
        { name: 'uk_short_code', unique: true, fields: ['short_code'] },
        { name: 'idx_workspace', fields: ['workspace_id'] },
        { name: 'idx_campaign', fields: ['campaign_id'] },
      ],
    },
  );
  return UtmLink;
}
