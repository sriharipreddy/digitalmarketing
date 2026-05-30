import { DataTypes, Model, type Sequelize } from 'sequelize';

/**
 * A conversion goal is a saved rule: "when an event named X with optional
 * property filters fires, count it as a conversion worth $value."
 */
export class ConversionGoal extends Model {
  declare id: string;
  declare workspace_id: string;
  declare name: string;
  declare description: string | null;
  declare event_name: string;
  declare property_filters: Record<string, string> | null;
  declare value_usd: number;
  declare is_active: boolean;
  declare created_by: string;
  declare created_at: Date;
  declare updated_at: Date;
}

export function defineConversionGoal(sequelize: Sequelize) {
  ConversionGoal.init(
    {
      id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      workspace_id: { type: DataTypes.CHAR(36), allowNull: false },
      name: { type: DataTypes.STRING(255), allowNull: false },
      description: { type: DataTypes.STRING(1000), allowNull: true },
      event_name: { type: DataTypes.STRING(100), allowNull: false },
      property_filters: { type: DataTypes.JSON, allowNull: true },
      value_usd: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      created_by: { type: DataTypes.CHAR(36), allowNull: false },
    },
    {
      sequelize,
      modelName: 'ConversionGoal',
      tableName: 'analytics_conversion_goals',
      timestamps: true,
      underscored: true,
      indexes: [
        { name: 'uk_workspace_name', unique: true, fields: ['workspace_id', 'name'] },
        { name: 'idx_workspace_event', fields: ['workspace_id', 'event_name'] },
      ],
    },
  );
  return ConversionGoal;
}
