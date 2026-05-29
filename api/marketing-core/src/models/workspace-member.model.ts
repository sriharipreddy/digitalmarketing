import { DataTypes, Model, type Sequelize } from 'sequelize';
import type { User } from './user.model.js';
import type { Workspace } from './workspace.model.js';

export class WorkspaceMember extends Model {
  declare id: string;
  declare workspace_id: string;
  declare user_id: string;
  declare role: 'owner' | 'editor' | 'analyst' | 'viewer';
  declare status: 'active' | 'invited' | 'suspended';
  declare invited_by: string | null;
  declare invite_token: string | null;
  declare invite_expires_at: Date | null;
  declare joined_at: Date | null;
  declare created_at: Date;
  declare updated_at: Date;
  declare deleted_at: Date | null;
}

export function defineWorkspaceMember(
  sequelize: Sequelize,
  models: { Workspace: typeof Workspace; User: typeof User },
) {
  WorkspaceMember.init(
    {
      id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      workspace_id: {
        type: DataTypes.CHAR(36),
        allowNull: false,
        references: { model: models.Workspace, key: 'id' },
      },
      user_id: {
        type: DataTypes.CHAR(36),
        allowNull: false,
        references: { model: models.User, key: 'id' },
      },
      role: {
        type: DataTypes.ENUM('owner', 'editor', 'analyst', 'viewer'),
        allowNull: false,
      },
      invited_by: { type: DataTypes.CHAR(36), allowNull: true },
      invite_token: { type: DataTypes.STRING(255), allowNull: true },
      invite_expires_at: { type: DataTypes.DATE, allowNull: true },
      joined_at: { type: DataTypes.DATE, allowNull: true },
      status: {
        type: DataTypes.ENUM('active', 'invited', 'suspended'),
        allowNull: false,
        defaultValue: 'invited',
      },
    },
    {
      sequelize,
      modelName: 'WorkspaceMember',
      tableName: 'core_workspace_members',
      timestamps: true,
      paranoid: true,
      underscored: true,
      indexes: [
        { name: 'uk_workspace_user', unique: true, fields: ['workspace_id', 'user_id'] },
        { name: 'idx_workspace', fields: ['workspace_id'] },
        { name: 'idx_user', fields: ['user_id'] },
        { name: 'idx_status', fields: ['status'] },
        { name: 'idx_invite_token', fields: ['invite_token'] },
      ],
    },
  );
  return WorkspaceMember;
}
