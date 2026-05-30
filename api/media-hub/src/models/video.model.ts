import { DataTypes, Model, type Sequelize } from 'sequelize';

export type VideoSource = 'youtube' | 'tiktok' | 'instagram_reel' | 'upload';
export type VideoStatus = 'imported' | 'transcribing' | 'transcribed' | 'failed';

export class Video extends Model {
  declare id: string;
  declare workspace_id: string;
  declare source: VideoSource;
  declare external_id: string | null;
  declare title: string;
  declare description: string | null;
  declare thumbnail_url: string | null;
  declare duration_seconds: number | null;
  declare view_count: number | null;
  declare published_at: Date | null;
  declare audio_url: string | null;
  declare transcript: string | null;
  declare transcript_language: string | null;
  declare status: VideoStatus;
  declare error: string | null;
  declare metadata: Record<string, unknown> | null;
  declare created_by: string;
  declare created_at: Date;
  declare updated_at: Date;
}

export function defineVideo(sequelize: Sequelize) {
  Video.init(
    {
      id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      workspace_id: { type: DataTypes.CHAR(36), allowNull: false },
      source: {
        type: DataTypes.ENUM('youtube', 'tiktok', 'instagram_reel', 'upload'),
        allowNull: false,
      },
      external_id: { type: DataTypes.STRING(255), allowNull: true },
      title: { type: DataTypes.STRING(500), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      thumbnail_url: { type: DataTypes.STRING(2000), allowNull: true },
      duration_seconds: { type: DataTypes.INTEGER, allowNull: true },
      view_count: { type: DataTypes.BIGINT, allowNull: true },
      published_at: { type: DataTypes.DATE, allowNull: true },
      audio_url: { type: DataTypes.STRING(2000), allowNull: true },
      transcript: { type: DataTypes.TEXT('long'), allowNull: true },
      transcript_language: { type: DataTypes.CHAR(5), allowNull: true },
      status: {
        type: DataTypes.ENUM('imported', 'transcribing', 'transcribed', 'failed'),
        allowNull: false,
        defaultValue: 'imported',
      },
      error: { type: DataTypes.STRING(2000), allowNull: true },
      metadata: { type: DataTypes.JSON, allowNull: true },
      created_by: { type: DataTypes.CHAR(36), allowNull: false },
    },
    {
      sequelize,
      modelName: 'Video',
      tableName: 'media_videos',
      timestamps: true,
      underscored: true,
      indexes: [
        { name: 'uk_workspace_source_external', unique: true, fields: ['workspace_id', 'source', 'external_id'] },
        { name: 'idx_workspace', fields: ['workspace_id'] },
        { name: 'idx_status', fields: ['status'] },
      ],
    },
  );
  return Video;
}
