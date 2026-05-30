import { DataTypes, Model, type Sequelize } from 'sequelize';

export type NpsBucket = 'detractor' | 'passive' | 'promoter';

export class NpsResponse extends Model {
  declare id: string;
  declare workspace_id: string;
  declare contact_id: string | null;
  declare email: string | null;
  declare score: number;
  declare bucket: NpsBucket;
  declare comment: string | null;
  declare survey_id: string | null;
  declare submitted_at: Date;
  declare created_at: Date;
  declare updated_at: Date;
}

export function defineNpsResponse(sequelize: Sequelize) {
  NpsResponse.init(
    {
      id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      workspace_id: { type: DataTypes.CHAR(36), allowNull: false },
      contact_id: { type: DataTypes.CHAR(36), allowNull: true },
      email: { type: DataTypes.STRING(255), allowNull: true },
      score: { type: DataTypes.INTEGER, allowNull: false },
      bucket: { type: DataTypes.ENUM('detractor', 'passive', 'promoter'), allowNull: false },
      comment: { type: DataTypes.TEXT, allowNull: true },
      survey_id: { type: DataTypes.STRING(255), allowNull: true },
      submitted_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      modelName: 'NpsResponse',
      tableName: 'crm_nps_responses',
      timestamps: true,
      underscored: true,
      indexes: [
        { name: 'idx_workspace_submitted', fields: ['workspace_id', 'submitted_at'] },
        { name: 'idx_workspace_bucket', fields: ['workspace_id', 'bucket'] },
      ],
    },
  );
  return NpsResponse;
}
