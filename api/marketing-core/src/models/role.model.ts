import { DataTypes, Model, type Sequelize } from 'sequelize';

export class Role extends Model {
  declare id: string;
  declare workspace_id: string | null;
  declare role_name: string;
  declare description: string | null;
  declare is_default: boolean;
}

export function defineRole(sequelize: Sequelize) {
  Role.init(
    {
      id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      workspace_id: { type: DataTypes.CHAR(36), allowNull: true },
      role_name: { type: DataTypes.STRING(100), allowNull: false },
      description: { type: DataTypes.STRING(500), allowNull: true },
      is_default: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    },
    {
      sequelize,
      modelName: 'Role',
      tableName: 'core_roles',
      timestamps: true,
      paranoid: true,
      underscored: true,
      indexes: [{ name: 'idx_workspace', fields: ['workspace_id'] }],
    },
  );
  return Role;
}
