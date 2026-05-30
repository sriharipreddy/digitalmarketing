import { DataTypes, Model, type Sequelize } from 'sequelize';

export class Competitor extends Model {
  declare id: string;
  declare workspace_id: string;
  declare name: string;
  declare domain: string;
  declare description: string | null;
  declare industry: string | null;
  declare est_monthly_traffic: number | null;
  declare est_employee_count: string | null;
  declare social_handles: Record<string, string> | null;
  declare strengths: string[] | null;
  declare weaknesses: string[] | null;
  declare last_analyzed_at: Date | null;
  declare created_by: string;
  declare created_at: Date;
  declare updated_at: Date;
}

export function defineCompetitor(sequelize: Sequelize) {
  Competitor.init(
    {
      id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      workspace_id: { type: DataTypes.CHAR(36), allowNull: false },
      name: { type: DataTypes.STRING(255), allowNull: false },
      domain: { type: DataTypes.STRING(255), allowNull: false },
      description: { type: DataTypes.STRING(2000), allowNull: true },
      industry: { type: DataTypes.STRING(100), allowNull: true },
      est_monthly_traffic: { type: DataTypes.BIGINT, allowNull: true },
      est_employee_count: { type: DataTypes.STRING(32), allowNull: true },
      social_handles: { type: DataTypes.JSON, allowNull: true },
      strengths: { type: DataTypes.JSON, allowNull: true },
      weaknesses: { type: DataTypes.JSON, allowNull: true },
      last_analyzed_at: { type: DataTypes.DATE, allowNull: true },
      created_by: { type: DataTypes.CHAR(36), allowNull: false },
    },
    {
      sequelize,
      modelName: 'Competitor',
      tableName: 'intelligence_competitors',
      timestamps: true,
      underscored: true,
      indexes: [
        { name: 'uk_workspace_domain', unique: true, fields: ['workspace_id', 'domain'] },
        { name: 'idx_workspace', fields: ['workspace_id'] },
      ],
    },
  );
  return Competitor;
}
