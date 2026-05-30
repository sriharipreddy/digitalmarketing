import { DataTypes, Model, type Sequelize } from 'sequelize';

/**
 * High-volume event ingestion table. Designed to be partition-friendly
 * (by `timestamp`) once we move to ClickHouse or a partitioned MariaDB table.
 */
export class AnalyticsEvent extends Model {
  declare id: string;
  declare workspace_id: string;
  declare anonymous_id: string;
  declare user_id: string | null;
  declare contact_email: string | null;
  declare event_name: string;
  declare properties: Record<string, unknown> | null;
  declare page_url: string | null;
  declare referrer: string | null;
  declare utm_source: string | null;
  declare utm_medium: string | null;
  declare utm_campaign: string | null;
  declare utm_term: string | null;
  declare utm_content: string | null;
  declare ip_address: string | null;
  declare user_agent: string | null;
  declare timestamp: Date;
  declare created_at: Date;
}

export function defineAnalyticsEvent(sequelize: Sequelize) {
  AnalyticsEvent.init(
    {
      id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      workspace_id: { type: DataTypes.CHAR(36), allowNull: false },
      anonymous_id: { type: DataTypes.STRING(64), allowNull: false },
      user_id: { type: DataTypes.CHAR(36), allowNull: true },
      contact_email: { type: DataTypes.STRING(255), allowNull: true },
      event_name: { type: DataTypes.STRING(100), allowNull: false },
      properties: { type: DataTypes.JSON, allowNull: true },
      page_url: { type: DataTypes.STRING(2000), allowNull: true },
      referrer: { type: DataTypes.STRING(2000), allowNull: true },
      utm_source: { type: DataTypes.STRING(64), allowNull: true },
      utm_medium: { type: DataTypes.STRING(64), allowNull: true },
      utm_campaign: { type: DataTypes.STRING(255), allowNull: true },
      utm_term: { type: DataTypes.STRING(255), allowNull: true },
      utm_content: { type: DataTypes.STRING(255), allowNull: true },
      ip_address: { type: DataTypes.STRING(45), allowNull: true },
      user_agent: { type: DataTypes.STRING(500), allowNull: true },
      timestamp: { type: DataTypes.DATE, allowNull: false },
    },
    {
      sequelize,
      modelName: 'AnalyticsEvent',
      tableName: 'analytics_events',
      timestamps: true,
      updatedAt: false,
      underscored: true,
      indexes: [
        { name: 'idx_workspace_timestamp', fields: ['workspace_id', 'timestamp'] },
        { name: 'idx_workspace_event', fields: ['workspace_id', 'event_name'] },
        { name: 'idx_anonymous', fields: ['anonymous_id'] },
        { name: 'idx_utm_campaign', fields: ['workspace_id', 'utm_campaign'] },
        { name: 'idx_contact_email', fields: ['contact_email'] },
      ],
    },
  );
  return AnalyticsEvent;
}
