import { DataTypes, Model, type Sequelize } from 'sequelize';

export class ImageGeneration extends Model {
  declare id: string;
  declare workspace_id: string;
  declare user_id: string;
  declare prompt: string;
  declare model: string;
  declare size: string;
  declare style: string | null;
  declare image_url: string;
  declare revised_prompt: string | null;
  declare cost_usd: number;
  declare created_at: Date;
}

export function defineImageGeneration(sequelize: Sequelize) {
  ImageGeneration.init(
    {
      id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      workspace_id: { type: DataTypes.CHAR(36), allowNull: false },
      user_id: { type: DataTypes.CHAR(36), allowNull: false },
      prompt: { type: DataTypes.TEXT, allowNull: false },
      model: { type: DataTypes.STRING(64), allowNull: false },
      size: { type: DataTypes.STRING(32), allowNull: false, defaultValue: '1024x1024' },
      style: { type: DataTypes.STRING(32), allowNull: true },
      image_url: { type: DataTypes.STRING(2000), allowNull: false },
      revised_prompt: { type: DataTypes.TEXT, allowNull: true },
      cost_usd: { type: DataTypes.DECIMAL(10, 4), allowNull: false, defaultValue: 0 },
    },
    {
      sequelize,
      modelName: 'ImageGeneration',
      tableName: 'media_image_generations',
      timestamps: true,
      updatedAt: false,
      underscored: true,
      indexes: [
        { name: 'idx_workspace_created', fields: ['workspace_id', 'created_at'] },
        { name: 'idx_user', fields: ['user_id'] },
      ],
    },
  );
  return ImageGeneration;
}
