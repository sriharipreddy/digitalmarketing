import { DataTypes, Model, type Sequelize } from 'sequelize';
import type { Workspace } from './workspace.model.js';
import type { Plan } from './plan.model.js';

export class Subscription extends Model {
  declare id: string;
  declare workspace_id: string;
  declare plan_id: string | null;
  declare stripe_subscription_id: string | null;
  declare stripe_customer_id: string | null;
  declare status:
    | 'trialing'
    | 'active'
    | 'past_due'
    | 'canceled'
    | 'incomplete'
    | 'incomplete_expired'
    | 'unpaid'
    | 'paused';
  declare current_period_end: Date | null;
  declare cancel_at_period_end: boolean;
  declare canceled_at: Date | null;
  declare metadata: Record<string, unknown> | null;
  declare created_at: Date;
  declare updated_at: Date;
}

export function defineSubscription(
  sequelize: Sequelize,
  models: { Workspace: typeof Workspace; Plan: typeof Plan },
) {
  Subscription.init(
    {
      id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      workspace_id: {
        type: DataTypes.CHAR(36),
        allowNull: false,
        references: { model: models.Workspace, key: 'id' },
      },
      plan_id: {
        type: DataTypes.CHAR(36),
        allowNull: true,
        references: { model: models.Plan, key: 'id' },
      },
      stripe_subscription_id: { type: DataTypes.STRING(255), allowNull: true },
      stripe_customer_id: { type: DataTypes.STRING(255), allowNull: true },
      status: {
        type: DataTypes.ENUM(
          'trialing',
          'active',
          'past_due',
          'canceled',
          'incomplete',
          'incomplete_expired',
          'unpaid',
          'paused',
        ),
        allowNull: false,
        defaultValue: 'trialing',
      },
      current_period_end: { type: DataTypes.DATE, allowNull: true },
      cancel_at_period_end: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      canceled_at: { type: DataTypes.DATE, allowNull: true },
      metadata: { type: DataTypes.JSON, allowNull: true },
    },
    {
      sequelize,
      modelName: 'Subscription',
      tableName: 'core_subscriptions',
      timestamps: true,
      underscored: true,
      indexes: [
        { name: 'uk_workspace', unique: true, fields: ['workspace_id'] },
        { name: 'uk_stripe_sub', unique: true, fields: ['stripe_subscription_id'] },
        { name: 'idx_status', fields: ['status'] },
      ],
    },
  );
  return Subscription;
}
