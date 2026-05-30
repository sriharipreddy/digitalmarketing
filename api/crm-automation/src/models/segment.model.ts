import { DataTypes, Model, type Sequelize } from 'sequelize';

export type SegmentFilterOp =
  | 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'
  | 'in' | 'nin' | 'contains' | 'starts_with' | 'ends_with' | 'exists' | 'not_exists';

export interface SegmentFilter {
  field: string;
  op: SegmentFilterOp;
  value?: unknown;
}

export interface SegmentDefinition {
  /** AND across filters; combine multi-segment OR by chaining segments. */
  filters: SegmentFilter[];
}

export class Segment extends Model {
  declare id: string;
  declare workspace_id: string;
  declare name: string;
  declare description: string | null;
  declare definition: SegmentDefinition;
  declare member_count: number;
  declare last_evaluated_at: Date | null;
  declare created_by: string | null;
  declare created_at: Date;
  declare updated_at: Date;
}

export function defineSegment(sequelize: Sequelize) {
  Segment.init(
    {
      id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      workspace_id: { type: DataTypes.CHAR(36), allowNull: false },
      name: { type: DataTypes.STRING(255), allowNull: false },
      description: { type: DataTypes.STRING(2000), allowNull: true },
      definition: { type: DataTypes.JSON, allowNull: false },
      member_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      last_evaluated_at: { type: DataTypes.DATE, allowNull: true },
      created_by: { type: DataTypes.CHAR(36), allowNull: true },
    },
    {
      sequelize,
      modelName: 'Segment',
      tableName: 'crm_segments',
      timestamps: true,
      underscored: true,
      indexes: [
        { name: 'idx_workspace_name', fields: ['workspace_id', 'name'] },
      ],
    },
  );
  return Segment;
}
