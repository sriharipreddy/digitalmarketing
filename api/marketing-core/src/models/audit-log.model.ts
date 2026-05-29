import { DataTypes, Model, type Sequelize } from 'sequelize';

export class AuditLog extends Model {
  declare id: string;
  declare workspace_id: string | null;
  declare actor_user_id: string | null;
  declare actor_type: 'user' | 'system' | 'api_key';
  declare action: string;
  declare target_type: string | null;
  declare target_id: string | null;
  declare ip_address: string | null;
  declare user_agent: string | null;
  declare request_id: string | null;
  declare metadata: Record<string, unknown> | null;
  declare created_at: Date;
}

export function defineAuditLog(sequelize: Sequelize) {
  AuditLog.init(
    {
      id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      workspace_id: { type: DataTypes.CHAR(36), allowNull: true },
      actor_user_id: { type: DataTypes.CHAR(36), allowNull: true },
      actor_type: {
        type: DataTypes.ENUM('user', 'system', 'api_key'),
        allowNull: false,
        defaultValue: 'user',
      },
      action: { type: DataTypes.STRING(100), allowNull: false },
      target_type: { type: DataTypes.STRING(64), allowNull: true },
      target_id: { type: DataTypes.STRING(64), allowNull: true },
      ip_address: { type: DataTypes.STRING(45), allowNull: true },
      user_agent: { type: DataTypes.STRING(500), allowNull: true },
      request_id: { type: DataTypes.STRING(64), allowNull: true },
      metadata: { type: DataTypes.JSON, allowNull: true },
    },
    {
      sequelize,
      modelName: 'AuditLog',
      tableName: 'core_audit_log',
      timestamps: true,
      updatedAt: false,
      underscored: true,
      indexes: [
        { name: 'idx_workspace_created', fields: ['workspace_id', 'created_at'] },
        { name: 'idx_actor', fields: ['actor_user_id'] },
        { name: 'idx_action', fields: ['action'] },
        { name: 'idx_target', fields: ['target_type', 'target_id'] },
      ],
    },
  );
  return AuditLog;
}
