import { DataTypes, Model, type Sequelize } from 'sequelize';

export class User extends Model {
  declare id: string;
  declare full_name: string;
  declare user_email: string;
  declare password_hash: string | null;
  declare type: 'platform_admin' | 'agency_owner' | 'client_owner' | 'team_member';
  declare status: 'active' | 'suspended' | 'invited' | 'pending_verify';
  declare email_verified: boolean;
  declare verify_token: string | null;
  declare verify_token_exp: Date | null;
  declare totp_secret: string | null;
  declare totp_required: boolean;
  declare preferred_locale: string;
  declare last_login_at: Date | null;
  declare created_at: Date;
  declare updated_at: Date;
  declare deleted_at: Date | null;
}

export function defineUser(sequelize: Sequelize) {
  User.init(
    {
      id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      full_name: { type: DataTypes.STRING(255), allowNull: false },
      user_email: { type: DataTypes.STRING(255), allowNull: false, validate: { isEmail: true } },
      password_hash: { type: DataTypes.STRING(255), allowNull: true },
      google_id: { type: DataTypes.STRING(255), allowNull: true },
      avatar_url: { type: DataTypes.STRING(500), allowNull: true },
      type: {
        type: DataTypes.ENUM('platform_admin', 'agency_owner', 'client_owner', 'team_member'),
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM('active', 'suspended', 'invited', 'pending_verify'),
        allowNull: false,
        defaultValue: 'pending_verify',
      },
      email_verified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      verify_token: { type: DataTypes.STRING(255), allowNull: true },
      verify_token_exp: { type: DataTypes.DATE, allowNull: true },
      totp_secret: { type: DataTypes.STRING(255), allowNull: true },
      totp_required: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      preferred_locale: { type: DataTypes.CHAR(5), allowNull: false, defaultValue: 'en' },
      last_login_at: { type: DataTypes.DATE, allowNull: true },
    },
    {
      sequelize,
      modelName: 'User',
      tableName: 'core_users',
      timestamps: true,
      paranoid: true,
      underscored: true,
      indexes: [
        { name: 'uk_email', unique: true, fields: ['user_email'] },
        { name: 'idx_type_status', fields: ['type', 'status'] },
        { name: 'idx_google', fields: ['google_id'] },
      ],
    },
  );
  return User;
}
