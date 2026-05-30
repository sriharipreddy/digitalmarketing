import { DataTypes, Model, type Sequelize } from 'sequelize';

export type CitationStatus = 'pending' | 'submitted' | 'live' | 'rejected';

export class LocalCitation extends Model {
  declare id: string;
  declare workspace_id: string;
  declare listing_id: string;
  declare directory_name: string;
  declare directory_url: string;
  declare submission_url: string | null;
  declare status: CitationStatus;
  declare submitted_at: Date | null;
  declare verified_at: Date | null;
  declare notes: string | null;
  declare created_at: Date;
  declare updated_at: Date;
}

export function defineLocalCitation(sequelize: Sequelize) {
  LocalCitation.init(
    {
      id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      workspace_id: { type: DataTypes.CHAR(36), allowNull: false },
      listing_id: { type: DataTypes.CHAR(36), allowNull: false },
      directory_name: { type: DataTypes.STRING(120), allowNull: false },
      directory_url: { type: DataTypes.STRING(2000), allowNull: false },
      submission_url: { type: DataTypes.STRING(2000), allowNull: true },
      status: {
        type: DataTypes.ENUM('pending', 'submitted', 'live', 'rejected'),
        allowNull: false,
        defaultValue: 'pending',
      },
      submitted_at: { type: DataTypes.DATE, allowNull: true },
      verified_at: { type: DataTypes.DATE, allowNull: true },
      notes: { type: DataTypes.STRING(2000), allowNull: true },
    },
    {
      sequelize,
      modelName: 'LocalCitation',
      tableName: 'seo_local_citations',
      timestamps: true,
      underscored: true,
      indexes: [
        { name: 'uk_listing_directory', unique: true, fields: ['listing_id', 'directory_name'] },
        { name: 'idx_workspace_status', fields: ['workspace_id', 'status'] },
      ],
    },
  );
  return LocalCitation;
}
