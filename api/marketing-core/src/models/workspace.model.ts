import { DataTypes, Model, type Sequelize } from 'sequelize';
import type { User } from './user.model.js';

export class Workspace extends Model {
  declare id: string;
  declare name: string;
  declare slug: string | null;
  declare domain: string | null;
  declare industry: string | null;
  declare country: string | null;
  declare logo_url: string | null;
  declare owner_id: string;
  declare agency_id: string | null;
  declare plan_id: string | null;
  declare status: 'trial' | 'active' | 'past_due' | 'suspended' | 'cancelled' | 'pending_deletion' | 'deleted';
  declare timezone: string;
  declare region: string;
  declare trial_ends_at: Date | null;
  declare stripe_customer_id: string | null;
  declare created_at: Date;
  declare updated_at: Date;
  declare deleted_at: Date | null;
}

export function defineWorkspace(sequelize: Sequelize, models: { User: typeof User }) {
  Workspace.init(
    {
      id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      name: { type: DataTypes.STRING(255), allowNull: false },
      slug: { type: DataTypes.STRING(100), allowNull: true },
      domain: { type: DataTypes.STRING(255), allowNull: true },
      industry: { type: DataTypes.STRING(100), allowNull: true },
      country: { type: DataTypes.CHAR(2), allowNull: true },
      timezone: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'Europe/London' },
      business_address: { type: DataTypes.JSON, allowNull: true },
      logo_url: { type: DataTypes.STRING(500), allowNull: true },
      owner_id: {
        type: DataTypes.CHAR(36),
        allowNull: false,
        references: { model: models.User, key: 'id' },
      },
      agency_id: { type: DataTypes.CHAR(36), allowNull: true },
      plan_id: { type: DataTypes.CHAR(36), allowNull: true },
      status: {
        type: DataTypes.ENUM('trial', 'active', 'past_due', 'suspended', 'cancelled', 'pending_deletion', 'deleted'),
        allowNull: false,
        defaultValue: 'trial',
      },
      trial_ends_at: { type: DataTypes.DATE, allowNull: true },
      cancelled_at: { type: DataTypes.DATE, allowNull: true },
      settings: { type: DataTypes.JSON, allowNull: true },
      ip_allowlist: { type: DataTypes.JSON, allowNull: true },
      region: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'eu-west-2' },
      stripe_customer_id: { type: DataTypes.STRING(255), allowNull: true },
    },
    {
      sequelize,
      modelName: 'Workspace',
      tableName: 'core_workspaces',
      timestamps: true,
      paranoid: true,
      underscored: true,
      indexes: [
        { name: 'uk_slug', unique: true, fields: ['slug'] },
        { name: 'idx_owner', fields: ['owner_id'] },
        { name: 'idx_agency', fields: ['agency_id'] },
        { name: 'idx_status', fields: ['status'] },
        { name: 'idx_stripe', fields: ['stripe_customer_id'] },
      ],
    },
  );
  return Workspace;
}
