import { DataTypes, Model, type Sequelize } from 'sequelize';

export class Plan extends Model {
  declare id: string;
  declare name: string;
  declare slug: string;
  declare price_monthly_gbp: number | null;
  declare price_yearly_gbp: number | null;
  declare features: Record<string, unknown>;
  declare limits: Record<string, unknown>;
  declare max_team_members: number;
  declare max_clients: number;
  declare is_agency_plan: boolean;
  declare is_active: boolean;
  declare display_order: number;
}

export function definePlan(sequelize: Sequelize) {
  Plan.init(
    {
      id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      name: { type: DataTypes.STRING(100), allowNull: false },
      slug: { type: DataTypes.STRING(50), allowNull: false },
      price_monthly_gbp: { type: DataTypes.DECIMAL(8, 2), allowNull: true },
      price_yearly_gbp: { type: DataTypes.DECIMAL(8, 2), allowNull: true },
      stripe_price_id_monthly: { type: DataTypes.STRING(255), allowNull: true },
      stripe_price_id_yearly: { type: DataTypes.STRING(255), allowNull: true },
      features: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
      limits: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
      max_team_members: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      max_clients: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      is_agency_plan: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      display_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    {
      sequelize,
      modelName: 'Plan',
      tableName: 'core_plans',
      timestamps: true,
      paranoid: true,
      underscored: true,
      indexes: [
        { name: 'uk_slug', unique: true, fields: ['slug'] },
        { name: 'idx_active', fields: ['is_active'] },
      ],
    },
  );
  return Plan;
}
