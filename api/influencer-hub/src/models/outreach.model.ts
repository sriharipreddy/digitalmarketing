import { DataTypes, Model, type Sequelize } from 'sequelize';
import type { Influencer } from './influencer.model.js';

export type OutreachStatus = 'draft' | 'sent' | 'replied' | 'accepted' | 'declined' | 'no_reply';

export class Outreach extends Model {
  declare id: string;
  declare workspace_id: string;
  declare influencer_id: string;
  declare channel: 'email' | 'dm' | 'phone';
  declare subject: string | null;
  declare body: string;
  declare status: OutreachStatus;
  declare sent_at: Date | null;
  declare replied_at: Date | null;
  declare reply_summary: string | null;
  declare created_by: string;
  declare created_at: Date;
  declare updated_at: Date;
}

export function defineOutreach(sequelize: Sequelize, models: { Influencer: typeof Influencer }) {
  Outreach.init(
    {
      id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      workspace_id: { type: DataTypes.CHAR(36), allowNull: false },
      influencer_id: {
        type: DataTypes.CHAR(36),
        allowNull: false,
        references: { model: models.Influencer, key: 'id' },
      },
      channel: { type: DataTypes.ENUM('email', 'dm', 'phone'), allowNull: false, defaultValue: 'email' },
      subject: { type: DataTypes.STRING(500), allowNull: true },
      body: { type: DataTypes.TEXT, allowNull: false },
      status: {
        type: DataTypes.ENUM('draft', 'sent', 'replied', 'accepted', 'declined', 'no_reply'),
        allowNull: false,
        defaultValue: 'draft',
      },
      sent_at: { type: DataTypes.DATE, allowNull: true },
      replied_at: { type: DataTypes.DATE, allowNull: true },
      reply_summary: { type: DataTypes.STRING(2000), allowNull: true },
      created_by: { type: DataTypes.CHAR(36), allowNull: false },
    },
    {
      sequelize,
      modelName: 'Outreach',
      tableName: 'influencer_outreach',
      timestamps: true,
      underscored: true,
      indexes: [
        { name: 'idx_workspace_status', fields: ['workspace_id', 'status'] },
        { name: 'idx_influencer', fields: ['influencer_id'] },
      ],
    },
  );
  return Outreach;
}
