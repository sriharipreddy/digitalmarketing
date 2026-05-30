import { DataTypes, Model, type Sequelize } from 'sequelize';

export type ProgramStatus = 'draft' | 'active' | 'paused' | 'archived';
export type CommissionKind = 'percent' | 'fixed_usd';
export type AttributionWindow = 'first_click' | 'last_click';

export class AffiliateProgram extends Model {
  declare id: string;
  declare workspace_id: string;
  declare name: string;
  declare description: string | null;
  declare commission_kind: CommissionKind;
  declare commission_value: number;
  declare attribution: AttributionWindow;
  declare cookie_days: number;
  declare status: ProgramStatus;
  declare terms_url: string | null;
  declare created_by: string;
  declare created_at: Date;
  declare updated_at: Date;
}

export function defineAffiliateProgram(sequelize: Sequelize) {
  AffiliateProgram.init(
    {
      id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      workspace_id: { type: DataTypes.CHAR(36), allowNull: false },
      name: { type: DataTypes.STRING(255), allowNull: false },
      description: { type: DataTypes.STRING(2000), allowNull: true },
      commission_kind: {
        type: DataTypes.ENUM('percent', 'fixed_usd'),
        allowNull: false,
        defaultValue: 'percent',
      },
      commission_value: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 10 },
      attribution: {
        type: DataTypes.ENUM('first_click', 'last_click'),
        allowNull: false,
        defaultValue: 'last_click',
      },
      cookie_days: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 30 },
      status: {
        type: DataTypes.ENUM('draft', 'active', 'paused', 'archived'),
        allowNull: false,
        defaultValue: 'draft',
      },
      terms_url: { type: DataTypes.STRING(2000), allowNull: true },
      created_by: { type: DataTypes.CHAR(36), allowNull: false },
    },
    {
      sequelize,
      modelName: 'AffiliateProgram',
      tableName: 'affiliate_programs',
      timestamps: true,
      underscored: true,
      indexes: [
        { name: 'uk_workspace_name', unique: true, fields: ['workspace_id', 'name'] },
        { name: 'idx_workspace_status', fields: ['workspace_id', 'status'] },
      ],
    },
  );
  return AffiliateProgram;
}
