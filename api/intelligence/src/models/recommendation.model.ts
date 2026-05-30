import { DataTypes, Model, type Sequelize } from 'sequelize';

export type RecommendationCategory =
  | 'budget_reallocation'
  | 'new_keyword'
  | 'paused_competitor_opportunity'
  | 'channel_expansion'
  | 'audience_segment'
  | 'creative_refresh';

export type RecommendationStatus = 'new' | 'accepted' | 'dismissed' | 'in_progress' | 'completed';

export class AutopilotRecommendation extends Model {
  declare id: string;
  declare workspace_id: string;
  declare category: RecommendationCategory;
  declare title: string;
  declare body: string;
  declare impact_estimate: string | null;
  declare confidence: 'low' | 'medium' | 'high';
  declare related_entities: Record<string, unknown> | null;
  declare status: RecommendationStatus;
  declare actioned_by: string | null;
  declare actioned_at: Date | null;
  declare created_at: Date;
  declare updated_at: Date;
}

export function defineRecommendation(sequelize: Sequelize) {
  AutopilotRecommendation.init(
    {
      id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      workspace_id: { type: DataTypes.CHAR(36), allowNull: false },
      category: {
        type: DataTypes.ENUM(
          'budget_reallocation',
          'new_keyword',
          'paused_competitor_opportunity',
          'channel_expansion',
          'audience_segment',
          'creative_refresh',
        ),
        allowNull: false,
      },
      title: { type: DataTypes.STRING(500), allowNull: false },
      body: { type: DataTypes.TEXT, allowNull: false },
      impact_estimate: { type: DataTypes.STRING(255), allowNull: true },
      confidence: {
        type: DataTypes.ENUM('low', 'medium', 'high'),
        allowNull: false,
        defaultValue: 'medium',
      },
      related_entities: { type: DataTypes.JSON, allowNull: true },
      status: {
        type: DataTypes.ENUM('new', 'accepted', 'dismissed', 'in_progress', 'completed'),
        allowNull: false,
        defaultValue: 'new',
      },
      actioned_by: { type: DataTypes.CHAR(36), allowNull: true },
      actioned_at: { type: DataTypes.DATE, allowNull: true },
    },
    {
      sequelize,
      modelName: 'AutopilotRecommendation',
      tableName: 'intelligence_recommendations',
      timestamps: true,
      underscored: true,
      indexes: [
        { name: 'idx_workspace_status', fields: ['workspace_id', 'status'] },
        { name: 'idx_workspace_category', fields: ['workspace_id', 'category'] },
      ],
    },
  );
  return AutopilotRecommendation;
}
