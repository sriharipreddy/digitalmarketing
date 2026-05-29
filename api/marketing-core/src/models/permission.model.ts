import { DataTypes, Model, type Sequelize } from 'sequelize';
import type { Role } from './role.model.js';

export class Permission extends Model {
  declare id: string;
  declare role_id: string;
  declare module_name: string;
  declare access: { c?: boolean; r?: boolean; u?: boolean; d?: boolean };
}

export function definePermission(sequelize: Sequelize, models: { Role: typeof Role }) {
  Permission.init(
    {
      id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      role_id: {
        type: DataTypes.CHAR(36),
        allowNull: false,
        references: { model: models.Role, key: 'id' },
        onDelete: 'CASCADE',
      },
      module_name: { type: DataTypes.STRING(100), allowNull: false },
      access: { type: DataTypes.JSON, allowNull: false },
    },
    {
      sequelize,
      modelName: 'Permission',
      tableName: 'core_permissions',
      timestamps: false,
      paranoid: false,
      underscored: true,
      indexes: [{ name: 'uk_role_module', unique: true, fields: ['role_id', 'module_name'] }],
    },
  );
  return Permission;
}
