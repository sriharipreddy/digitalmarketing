import type { Sequelize } from 'sequelize';
import { defineUser } from './user.model.js';
import { defineWorkspace } from './workspace.model.js';
import { defineWorkspaceMember } from './workspace-member.model.js';
import { defineAuthSession } from './auth-session.model.js';
import { defineRole } from './role.model.js';
import { definePermission } from './permission.model.js';
import { definePlan } from './plan.model.js';
import { defineAuditLog } from './audit-log.model.js';
import { defineSubscription } from './subscription.model.js';

export function initModels(sequelize: Sequelize) {
  // Define independent models first
  const User = defineUser(sequelize);
  const Plan = definePlan(sequelize);
  const Role = defineRole(sequelize);
  const AuditLog = defineAuditLog(sequelize);

  // Then models with FK dependencies
  const Workspace = defineWorkspace(sequelize, { User });
  const WorkspaceMember = defineWorkspaceMember(sequelize, { Workspace, User });
  const AuthSession = defineAuthSession(sequelize, { User });
  const Permission = definePermission(sequelize, { Role });
  const Subscription = defineSubscription(sequelize, { Workspace, Plan });

  // Associations
  User.hasMany(WorkspaceMember, { foreignKey: 'user_id', as: 'memberships' });
  Workspace.hasMany(WorkspaceMember, { foreignKey: 'workspace_id', as: 'members' });
  WorkspaceMember.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
  WorkspaceMember.belongsTo(Workspace, { foreignKey: 'workspace_id', as: 'workspace' });
  Workspace.belongsTo(User, { foreignKey: 'owner_id', as: 'owner' });
  Workspace.hasOne(Subscription, { foreignKey: 'workspace_id', as: 'subscription' });
  Subscription.belongsTo(Workspace, { foreignKey: 'workspace_id', as: 'workspace' });
  Subscription.belongsTo(Plan, { foreignKey: 'plan_id', as: 'plan' });

  return {
    User,
    Plan,
    Role,
    Workspace,
    WorkspaceMember,
    AuthSession,
    Permission,
    AuditLog,
    Subscription,
  };
}

export type Models = ReturnType<typeof initModels>;
