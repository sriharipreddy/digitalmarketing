import { DataTypes, Model, type Sequelize } from 'sequelize';

export type ReviewSentiment = 'positive' | 'neutral' | 'negative';

export class LocalReview extends Model {
  declare id: string;
  declare workspace_id: string;
  declare listing_id: string;
  declare provider_review_id: string;
  declare author_name: string | null;
  declare rating: number;
  declare body: string | null;
  declare response_body: string | null;
  declare sentiment: ReviewSentiment | null;
  declare posted_at: Date;
  declare responded_at: Date | null;
  declare created_at: Date;
  declare updated_at: Date;
}

export function defineLocalReview(sequelize: Sequelize) {
  LocalReview.init(
    {
      id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      workspace_id: { type: DataTypes.CHAR(36), allowNull: false },
      listing_id: { type: DataTypes.CHAR(36), allowNull: false },
      provider_review_id: { type: DataTypes.STRING(255), allowNull: false },
      author_name: { type: DataTypes.STRING(255), allowNull: true },
      rating: { type: DataTypes.INTEGER, allowNull: false },
      body: { type: DataTypes.TEXT, allowNull: true },
      response_body: { type: DataTypes.TEXT, allowNull: true },
      sentiment: { type: DataTypes.ENUM('positive', 'neutral', 'negative'), allowNull: true },
      posted_at: { type: DataTypes.DATE, allowNull: false },
      responded_at: { type: DataTypes.DATE, allowNull: true },
    },
    {
      sequelize,
      modelName: 'LocalReview',
      tableName: 'seo_local_reviews',
      timestamps: true,
      underscored: true,
      indexes: [
        { name: 'uk_listing_review', unique: true, fields: ['listing_id', 'provider_review_id'] },
        { name: 'idx_workspace_posted', fields: ['workspace_id', 'posted_at'] },
      ],
    },
  );
  return LocalReview;
}
