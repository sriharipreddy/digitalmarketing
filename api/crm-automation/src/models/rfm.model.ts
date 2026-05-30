import { DataTypes, Model, type Sequelize } from 'sequelize';

/**
 * Per-contact RFM score from the most recent analysis run. Recency / Frequency /
 * Monetary each on a 1-5 scale; segment is the well-known label
 * (champion, loyal_customer, at_risk, hibernating, lost, etc.).
 */
export type RfmSegmentLabel =
  | 'champion'
  | 'loyal_customer'
  | 'potential_loyalist'
  | 'new_customer'
  | 'promising'
  | 'needs_attention'
  | 'about_to_sleep'
  | 'at_risk'
  | 'cant_lose'
  | 'hibernating'
  | 'lost';

export class RfmScore extends Model {
  declare id: string;
  declare workspace_id: string;
  declare contact_id: string;
  declare recency_score: number;
  declare frequency_score: number;
  declare monetary_score: number;
  declare segment_label: RfmSegmentLabel;
  declare last_order_at: Date | null;
  declare order_count: number;
  declare lifetime_value_usd: number;
  declare analyzed_at: Date;
  declare created_at: Date;
  declare updated_at: Date;
}

export function defineRfmScore(sequelize: Sequelize) {
  RfmScore.init(
    {
      id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      workspace_id: { type: DataTypes.CHAR(36), allowNull: false },
      contact_id: { type: DataTypes.CHAR(36), allowNull: false },
      recency_score: { type: DataTypes.INTEGER, allowNull: false },
      frequency_score: { type: DataTypes.INTEGER, allowNull: false },
      monetary_score: { type: DataTypes.INTEGER, allowNull: false },
      segment_label: {
        type: DataTypes.ENUM(
          'champion',
          'loyal_customer',
          'potential_loyalist',
          'new_customer',
          'promising',
          'needs_attention',
          'about_to_sleep',
          'at_risk',
          'cant_lose',
          'hibernating',
          'lost',
        ),
        allowNull: false,
      },
      last_order_at: { type: DataTypes.DATE, allowNull: true },
      order_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      lifetime_value_usd: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      analyzed_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      modelName: 'RfmScore',
      tableName: 'crm_rfm_scores',
      timestamps: true,
      underscored: true,
      indexes: [
        { name: 'uk_workspace_contact', unique: true, fields: ['workspace_id', 'contact_id'] },
        { name: 'idx_workspace_segment', fields: ['workspace_id', 'segment_label'] },
      ],
    },
  );
  return RfmScore;
}
