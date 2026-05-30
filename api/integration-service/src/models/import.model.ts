import { DataTypes, Model, type Sequelize } from 'sequelize';

export type ImportSource = 'csv' | 'hubspot' | 'mailchimp' | 'klaviyo';
export type ImportEntity = 'contacts' | 'companies' | 'lists' | 'campaigns';
export type ImportStatus = 'pending' | 'mapping' | 'processing' | 'completed' | 'failed';

export class DataImport extends Model {
  declare id: string;
  declare workspace_id: string;
  declare source: ImportSource;
  declare entity: ImportEntity;
  declare source_file_url: string | null;
  declare credentials_ref: string | null;
  declare column_mapping: Record<string, string> | null;
  declare status: ImportStatus;
  declare total_rows: number;
  declare processed_rows: number;
  declare succeeded_rows: number;
  declare failed_rows: number;
  declare error: string | null;
  declare created_by: string | null;
  declare started_at: Date | null;
  declare completed_at: Date | null;
  declare created_at: Date;
  declare updated_at: Date;
}

export function defineDataImport(sequelize: Sequelize) {
  DataImport.init(
    {
      id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      workspace_id: { type: DataTypes.CHAR(36), allowNull: false },
      source: { type: DataTypes.ENUM('csv', 'hubspot', 'mailchimp', 'klaviyo'), allowNull: false },
      entity: { type: DataTypes.ENUM('contacts', 'companies', 'lists', 'campaigns'), allowNull: false },
      source_file_url: { type: DataTypes.STRING(2000), allowNull: true },
      credentials_ref: { type: DataTypes.STRING(255), allowNull: true },
      column_mapping: { type: DataTypes.JSON, allowNull: true },
      status: {
        type: DataTypes.ENUM('pending', 'mapping', 'processing', 'completed', 'failed'),
        allowNull: false,
        defaultValue: 'pending',
      },
      total_rows: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      processed_rows: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      succeeded_rows: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      failed_rows: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      error: { type: DataTypes.STRING(2000), allowNull: true },
      created_by: { type: DataTypes.CHAR(36), allowNull: true },
      started_at: { type: DataTypes.DATE, allowNull: true },
      completed_at: { type: DataTypes.DATE, allowNull: true },
    },
    {
      sequelize,
      modelName: 'DataImport',
      tableName: 'integration_data_imports',
      timestamps: true,
      underscored: true,
      indexes: [
        { name: 'idx_workspace_created', fields: ['workspace_id', 'created_at'] },
        { name: 'idx_status', fields: ['status'] },
      ],
    },
  );
  return DataImport;
}
