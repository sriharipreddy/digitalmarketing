import { DataTypes, Model, type Sequelize } from 'sequelize';

export class Keyword extends Model {
  declare id: string;
  declare workspace_id: string;
  declare keyword: string;
  declare search_volume: number | null;
  declare difficulty: number | null;
  declare cpc: number | null;
  declare country: string;
  declare language: string;
  declare intent: 'informational' | 'navigational' | 'transactional' | 'commercial' | null;
  declare tags: string[] | null;
  declare created_at: Date;
  declare updated_at: Date;
}

export function defineKeyword(sequelize: Sequelize) {
  Keyword.init(
    {
      id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      workspace_id: { type: DataTypes.CHAR(36), allowNull: false },
      keyword: { type: DataTypes.STRING(255), allowNull: false },
      search_volume: { type: DataTypes.INTEGER, allowNull: true },
      difficulty: { type: DataTypes.INTEGER, allowNull: true },
      cpc: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      country: { type: DataTypes.CHAR(2), allowNull: false, defaultValue: 'US' },
      language: { type: DataTypes.CHAR(2), allowNull: false, defaultValue: 'en' },
      intent: {
        type: DataTypes.ENUM('informational', 'navigational', 'transactional', 'commercial'),
        allowNull: true,
      },
      tags: { type: DataTypes.JSON, allowNull: true },
    },
    {
      sequelize,
      modelName: 'Keyword',
      tableName: 'seo_keywords',
      timestamps: true,
      underscored: true,
      indexes: [
        { name: 'uk_workspace_keyword_country', unique: true, fields: ['workspace_id', 'keyword', 'country'] },
        { name: 'idx_workspace', fields: ['workspace_id'] },
      ],
    },
  );
  return Keyword;
}
