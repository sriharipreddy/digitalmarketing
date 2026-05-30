import { DataTypes, Model, type Sequelize } from 'sequelize';
import type { Affiliate } from './affiliate.model.js';

export type CommissionStatus = 'pending' | 'approved' | 'paid' | 'reversed' | 'rejected';

export class Commission extends Model {
  declare id: string;
  declare workspace_id: string;
  declare affiliate_id: string;
  declare tracking_link_id: string | null;
  declare order_external_id: string;
  declare order_amount_usd: number;
  declare commission_usd: number;
  declare currency: string;
  declare customer_email: string | null;
  declare status: CommissionStatus;
  declare approved_at: Date | null;
  declare paid_at: Date | null;
  declare reversed_at: Date | null;
  declare metadata: Record<string, unknown> | null;
  declare created_at: Date;
  declare updated_at: Date;
}

export function defineCommission(sequelize: Sequelize, models: { Affiliate: typeof Affiliate }) {
  Commission.init(
    {
      id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      workspace_id: { type: DataTypes.CHAR(36), allowNull: false },
      affiliate_id: {
        type: DataTypes.CHAR(36),
        allowNull: false,
        references: { model: models.Affiliate, key: 'id' },
      },
      tracking_link_id: { type: DataTypes.CHAR(36), allowNull: true },
      order_external_id: { type: DataTypes.STRING(255), allowNull: false },
      order_amount_usd: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      commission_usd: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'USD' },
      customer_email: { type: DataTypes.STRING(255), allowNull: true },
      status: {
        type: DataTypes.ENUM('pending', 'approved', 'paid', 'reversed', 'rejected'),
        allowNull: false,
        defaultValue: 'pending',
      },
      approved_at: { type: DataTypes.DATE, allowNull: true },
      paid_at: { type: DataTypes.DATE, allowNull: true },
      reversed_at: { type: DataTypes.DATE, allowNull: true },
      metadata: { type: DataTypes.JSON, allowNull: true },
    },
    {
      sequelize,
      modelName: 'Commission',
      tableName: 'affiliate_commissions',
      timestamps: true,
      underscored: true,
      indexes: [
        { name: 'uk_workspace_order', unique: true, fields: ['workspace_id', 'order_external_id'] },
        { name: 'idx_affiliate_status', fields: ['affiliate_id', 'status'] },
        { name: 'idx_workspace_status', fields: ['workspace_id', 'status'] },
      ],
    },
  );
  return Commission;
}
