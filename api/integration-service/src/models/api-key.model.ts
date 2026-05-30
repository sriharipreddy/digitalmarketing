import { DataTypes, Model, type Sequelize } from 'sequelize';

export type ApiKeyStatus = 'active' | 'revoked' | 'expired';

export class ApiKey extends Model {
  declare id: string;
  declare workspace_id: string;
  declare name: string;
  declare prefix: string;          // First 8 chars (shown to user as identifier — "mk_a1b2c3d4")
  declare hash: string;            // bcrypt-style hash of the full secret
  declare scopes: string[];        // ['campaigns:read', 'campaigns:write', ...] — empty = full
  declare status: ApiKeyStatus;
  declare last_used_at: Date | null;
  declare expires_at: Date | null;
  declare created_by: string;
  declare created_at: Date;
}

export function defineApiKey(sequelize: Sequelize) {
  ApiKey.init(
    {
      id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      workspace_id: { type: DataTypes.CHAR(36), allowNull: false },
      name: { type: DataTypes.STRING(255), allowNull: false },
      prefix: { type: DataTypes.STRING(16), allowNull: false },
      hash: { type: DataTypes.STRING(255), allowNull: false },
      scopes: { type: DataTypes.JSON, allowNull: true },
      status: {
        type: DataTypes.ENUM('active', 'revoked', 'expired'),
        allowNull: false,
        defaultValue: 'active',
      },
      last_used_at: { type: DataTypes.DATE, allowNull: true },
      expires_at: { type: DataTypes.DATE, allowNull: true },
      created_by: { type: DataTypes.CHAR(36), allowNull: false },
    },
    {
      sequelize,
      modelName: 'ApiKey',
      tableName: 'integration_api_keys',
      timestamps: true,
      updatedAt: false,
      underscored: true,
      indexes: [
        { name: 'idx_workspace_status', fields: ['workspace_id', 'status'] },
        { name: 'idx_prefix', fields: ['prefix'] },
      ],
    },
  );
  return ApiKey;
}
