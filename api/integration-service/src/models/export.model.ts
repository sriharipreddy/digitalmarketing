import { DataTypes, Model, type Sequelize } from 'sequelize';

export type ExportKind = 'dsar' | 'workspace_backup' | 'segment_csv';
export type ExportStatus = 'pending' | 'building' | 'ready' | 'expired' | 'failed';

/**
 * DSAR (Data Subject Access Request) export — captures everything we hold about a
 * single subject (contact email, user id, etc.) so the workspace can respond to a
 * GDPR Article 15 request within 30 days.
 */
export class DataExport extends Model {
  declare id: string;
  declare workspace_id: string;
  declare kind: ExportKind;
  declare subject_email: string | null;
  declare subject_user_id: string | null;
  declare requested_by: string | null;
  declare status: ExportStatus;
  declare file_url: string | null;
  declare manifest: Record<string, unknown> | null;
  declare expires_at: Date | null;
  declare error: string | null;
  declare created_at: Date;
  declare updated_at: Date;
}

export function defineDataExport(sequelize: Sequelize) {
  DataExport.init(
    {
      id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      workspace_id: { type: DataTypes.CHAR(36), allowNull: false },
      kind: { type: DataTypes.ENUM('dsar', 'workspace_backup', 'segment_csv'), allowNull: false },
      subject_email: { type: DataTypes.STRING(255), allowNull: true },
      subject_user_id: { type: DataTypes.CHAR(36), allowNull: true },
      requested_by: { type: DataTypes.CHAR(36), allowNull: true },
      status: {
        type: DataTypes.ENUM('pending', 'building', 'ready', 'expired', 'failed'),
        allowNull: false,
        defaultValue: 'pending',
      },
      file_url: { type: DataTypes.STRING(2000), allowNull: true },
      manifest: { type: DataTypes.JSON, allowNull: true },
      expires_at: { type: DataTypes.DATE, allowNull: true },
      error: { type: DataTypes.STRING(2000), allowNull: true },
    },
    {
      sequelize,
      modelName: 'DataExport',
      tableName: 'integration_data_exports',
      timestamps: true,
      underscored: true,
      indexes: [
        { name: 'idx_workspace_created', fields: ['workspace_id', 'created_at'] },
        { name: 'idx_status', fields: ['status'] },
      ],
    },
  );
  return DataExport;
}
