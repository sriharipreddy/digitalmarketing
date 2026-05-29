import { DataTypes, Model, type Sequelize } from 'sequelize';
import type { User } from './user.model.js';

export class AuthSession extends Model {
  declare id: string;
  declare user_id: string;
  declare workspace_id: string | null;
  declare refresh_token: string;
  declare expires_at: Date;
  declare revoked_at: Date | null;
}

export function defineAuthSession(sequelize: Sequelize, models: { User: typeof User }) {
  AuthSession.init(
    {
      id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      user_id: {
        type: DataTypes.CHAR(36),
        allowNull: false,
        references: { model: models.User, key: 'id' },
        onDelete: 'CASCADE',
      },
      workspace_id: { type: DataTypes.CHAR(36), allowNull: true },
      refresh_token: { type: DataTypes.STRING(500), allowNull: false },
      device_info: { type: DataTypes.JSON, allowNull: true },
      ip_address: { type: DataTypes.STRING(45), allowNull: true },
      expires_at: { type: DataTypes.DATE, allowNull: false },
      revoked_at: { type: DataTypes.DATE, allowNull: true },
      last_used_at: { type: DataTypes.DATE, allowNull: true },
    },
    {
      sequelize,
      modelName: 'AuthSession',
      tableName: 'core_auth_sessions',
      timestamps: true,
      paranoid: false,
      underscored: true,
      indexes: [
        { name: 'idx_user', fields: ['user_id'] },
        { name: 'idx_token', fields: [{ name: 'refresh_token', length: 100 }] },
        { name: 'idx_expires', fields: ['expires_at'] },
      ],
    },
  );
  return AuthSession;
}
