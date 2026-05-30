import { DataTypes, Model, type Sequelize } from 'sequelize';

export class NotificationPreference extends Model {
  declare id: string;
  declare workspace_id: string;
  declare user_id: string;
  /** JSON keyed by NotificationKind → channel flags. */
  declare preferences: Record<string, { in_app?: boolean; email?: boolean; digest?: boolean }>;
  declare digest_frequency: 'never' | 'daily' | 'weekly';
  declare quiet_hours_start: string | null;
  declare quiet_hours_end: string | null;
  declare timezone: string;
  declare created_at: Date;
  declare updated_at: Date;
}

export function defineNotificationPreference(sequelize: Sequelize) {
  NotificationPreference.init(
    {
      id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      workspace_id: { type: DataTypes.CHAR(36), allowNull: false },
      user_id: { type: DataTypes.CHAR(36), allowNull: false },
      preferences: { type: DataTypes.JSON, allowNull: false },
      digest_frequency: {
        type: DataTypes.ENUM('never', 'daily', 'weekly'),
        allowNull: false,
        defaultValue: 'weekly',
      },
      quiet_hours_start: { type: DataTypes.STRING(5), allowNull: true },
      quiet_hours_end: { type: DataTypes.STRING(5), allowNull: true },
      timezone: { type: DataTypes.STRING(64), allowNull: false, defaultValue: 'UTC' },
    },
    {
      sequelize,
      modelName: 'NotificationPreference',
      tableName: 'notif_preferences',
      timestamps: true,
      underscored: true,
      indexes: [
        { name: 'uk_workspace_user', unique: true, fields: ['workspace_id', 'user_id'] },
      ],
    },
  );
  return NotificationPreference;
}
