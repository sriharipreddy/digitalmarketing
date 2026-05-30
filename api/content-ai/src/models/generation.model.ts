import { DataTypes, Model, type Sequelize } from 'sequelize';

export class Generation extends Model {
  declare id: string;
  declare workspace_id: string;
  declare user_id: string;
  declare kind: 'blog' | 'social' | 'email' | 'ad_copy' | 'headline';
  declare brand_voice_id: string | null;
  declare prompt: string;
  declare model: string;
  declare output: string;
  declare prompt_tokens: number;
  declare completion_tokens: number;
  declare total_tokens: number;
  declare cost_usd: number;
  declare created_at: Date;
}

export function defineGeneration(sequelize: Sequelize) {
  Generation.init(
    {
      id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      workspace_id: { type: DataTypes.CHAR(36), allowNull: false },
      user_id: { type: DataTypes.CHAR(36), allowNull: false },
      kind: {
        type: DataTypes.ENUM('blog', 'social', 'email', 'ad_copy', 'headline'),
        allowNull: false,
      },
      brand_voice_id: { type: DataTypes.CHAR(36), allowNull: true },
      prompt: { type: DataTypes.TEXT, allowNull: false },
      model: { type: DataTypes.STRING(64), allowNull: false },
      output: { type: DataTypes.TEXT('long'), allowNull: false },
      prompt_tokens: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      completion_tokens: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      total_tokens: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      cost_usd: { type: DataTypes.DECIMAL(10, 4), allowNull: false, defaultValue: 0 },
    },
    {
      sequelize,
      modelName: 'Generation',
      tableName: 'content_generations',
      timestamps: true,
      updatedAt: false,
      underscored: true,
      indexes: [
        { name: 'idx_workspace_created', fields: ['workspace_id', 'created_at'] },
        { name: 'idx_user', fields: ['user_id'] },
      ],
    },
  );
  return Generation;
}
