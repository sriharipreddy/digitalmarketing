import { DataTypes, Model, type Sequelize } from 'sequelize';

export type SocialPlatform = 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'tiktok' | 'youtube';
export type AccountStatus = 'connected' | 'expired' | 'revoked' | 'error';

export class SocialAccount extends Model {
  declare id: string;
  declare workspace_id: string;
  declare platform: SocialPlatform;
  declare external_id: string;
  declare handle: string;
  declare display_name: string | null;
  declare avatar_url: string | null;
  declare access_token_encrypted: string;
  declare refresh_token_encrypted: string | null;
  declare token_expires_at: Date | null;
  declare scopes: string[] | null;
  declare status: AccountStatus;
  declare last_error: string | null;
  declare connected_by: string;
  declare created_at: Date;
  declare updated_at: Date;
}

export function defineSocialAccount(sequelize: Sequelize) {
  SocialAccount.init(
    {
      id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      workspace_id: { type: DataTypes.CHAR(36), allowNull: false },
      platform: {
        type: DataTypes.ENUM('facebook', 'instagram', 'twitter', 'linkedin', 'tiktok', 'youtube'),
        allowNull: false,
      },
      external_id: { type: DataTypes.STRING(255), allowNull: false },
      handle: { type: DataTypes.STRING(255), allowNull: false },
      display_name: { type: DataTypes.STRING(255), allowNull: true },
      avatar_url: { type: DataTypes.STRING(500), allowNull: true },
      access_token_encrypted: { type: DataTypes.TEXT, allowNull: false },
      refresh_token_encrypted: { type: DataTypes.TEXT, allowNull: true },
      token_expires_at: { type: DataTypes.DATE, allowNull: true },
      scopes: { type: DataTypes.JSON, allowNull: true },
      status: {
        type: DataTypes.ENUM('connected', 'expired', 'revoked', 'error'),
        allowNull: false,
        defaultValue: 'connected',
      },
      last_error: { type: DataTypes.STRING(2000), allowNull: true },
      connected_by: { type: DataTypes.CHAR(36), allowNull: false },
    },
    {
      sequelize,
      modelName: 'SocialAccount',
      tableName: 'social_accounts',
      timestamps: true,
      underscored: true,
      indexes: [
        { name: 'uk_workspace_platform_external', unique: true, fields: ['workspace_id', 'platform', 'external_id'] },
        { name: 'idx_workspace_platform', fields: ['workspace_id', 'platform'] },
        { name: 'idx_status', fields: ['status'] },
      ],
    },
  );
  return SocialAccount;
}
