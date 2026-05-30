import { DataTypes, Model, type Sequelize } from 'sequelize';
import type { AffiliateProgram } from './program.model.js';

export type AffiliateStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export class Affiliate extends Model {
  declare id: string;
  declare workspace_id: string;
  declare program_id: string;
  declare email: string;
  declare full_name: string | null;
  declare payout_method: string | null;
  declare payout_details: Record<string, unknown> | null;
  declare status: AffiliateStatus;
  declare approved_at: Date | null;
  declare created_at: Date;
  declare updated_at: Date;
}

export function defineAffiliate(sequelize: Sequelize, models: { AffiliateProgram: typeof AffiliateProgram }) {
  Affiliate.init(
    {
      id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      workspace_id: { type: DataTypes.CHAR(36), allowNull: false },
      program_id: {
        type: DataTypes.CHAR(36),
        allowNull: false,
        references: { model: models.AffiliateProgram, key: 'id' },
      },
      email: { type: DataTypes.STRING(255), allowNull: false },
      full_name: { type: DataTypes.STRING(255), allowNull: true },
      payout_method: { type: DataTypes.STRING(32), allowNull: true },
      payout_details: { type: DataTypes.JSON, allowNull: true },
      status: {
        type: DataTypes.ENUM('pending', 'approved', 'rejected', 'suspended'),
        allowNull: false,
        defaultValue: 'pending',
      },
      approved_at: { type: DataTypes.DATE, allowNull: true },
    },
    {
      sequelize,
      modelName: 'Affiliate',
      tableName: 'affiliate_affiliates',
      timestamps: true,
      underscored: true,
      indexes: [
        { name: 'uk_program_email', unique: true, fields: ['program_id', 'email'] },
        { name: 'idx_workspace_status', fields: ['workspace_id', 'status'] },
      ],
    },
  );
  return Affiliate;
}
