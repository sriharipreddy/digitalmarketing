import { DataTypes, Model, type Sequelize } from 'sequelize';

export class BrandVoice extends Model {
  declare id: string;
  declare workspace_id: string;
  declare name: string;
  declare description: string | null;
  declare tone: string;
  declare style: string | null;
  declare sample_text: string | null;
  declare created_at: Date;
  declare updated_at: Date;
}

export function defineBrandVoice(sequelize: Sequelize) {
  BrandVoice.init(
    {
      id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      workspace_id: { type: DataTypes.CHAR(36), allowNull: false },
      name: { type: DataTypes.STRING(100), allowNull: false },
      description: { type: DataTypes.STRING(500), allowNull: true },
      tone: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'professional' },
      style: { type: DataTypes.STRING(100), allowNull: true },
      sample_text: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      sequelize,
      modelName: 'BrandVoice',
      tableName: 'content_brand_voices',
      timestamps: true,
      underscored: true,
      indexes: [
        { name: 'uk_workspace_name', unique: true, fields: ['workspace_id', 'name'] },
        { name: 'idx_workspace', fields: ['workspace_id'] },
      ],
    },
  );
  return BrandVoice;
}
