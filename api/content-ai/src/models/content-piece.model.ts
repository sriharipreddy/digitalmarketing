import { DataTypes, Model, type Sequelize } from 'sequelize';

export type ContentKind = 'blog' | 'social' | 'email' | 'ad_copy' | 'headline' | 'landing_page' | 'press_release';
export type ContentStatus = 'draft' | 'in_review' | 'scheduled' | 'published' | 'archived';

export class ContentPiece extends Model {
  declare id: string;
  declare workspace_id: string;
  declare kind: ContentKind;
  declare title: string;
  declare body: string;
  declare brand_voice_id: string | null;
  declare source_generation_id: string | null;
  declare language: string;
  declare status: ContentStatus;
  declare scheduled_at: Date | null;
  declare published_at: Date | null;
  declare tags: string[] | null;
  declare metadata: Record<string, unknown> | null;
  declare created_by: string;
  declare created_at: Date;
  declare updated_at: Date;
}

export function defineContentPiece(sequelize: Sequelize) {
  ContentPiece.init(
    {
      id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      workspace_id: { type: DataTypes.CHAR(36), allowNull: false },
      kind: {
        type: DataTypes.ENUM('blog', 'social', 'email', 'ad_copy', 'headline', 'landing_page', 'press_release'),
        allowNull: false,
      },
      title: { type: DataTypes.STRING(500), allowNull: false },
      body: { type: DataTypes.TEXT('long'), allowNull: false },
      brand_voice_id: { type: DataTypes.CHAR(36), allowNull: true },
      source_generation_id: { type: DataTypes.CHAR(36), allowNull: true },
      language: { type: DataTypes.CHAR(5), allowNull: false, defaultValue: 'en' },
      status: {
        type: DataTypes.ENUM('draft', 'in_review', 'scheduled', 'published', 'archived'),
        allowNull: false,
        defaultValue: 'draft',
      },
      scheduled_at: { type: DataTypes.DATE, allowNull: true },
      published_at: { type: DataTypes.DATE, allowNull: true },
      tags: { type: DataTypes.JSON, allowNull: true },
      metadata: { type: DataTypes.JSON, allowNull: true },
      created_by: { type: DataTypes.CHAR(36), allowNull: false },
    },
    {
      sequelize,
      modelName: 'ContentPiece',
      tableName: 'content_pieces',
      timestamps: true,
      underscored: true,
      indexes: [
        { name: 'idx_workspace_status', fields: ['workspace_id', 'status'] },
        { name: 'idx_workspace_kind', fields: ['workspace_id', 'kind'] },
        { name: 'idx_scheduled', fields: ['scheduled_at'] },
      ],
    },
  );
  return ContentPiece;
}
