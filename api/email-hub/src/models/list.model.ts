import { DataTypes, Model, type Sequelize } from 'sequelize';

/**
 * A "list" is a saved filter over crm_contacts (resolved lazily at send time).
 * Filter shape: { tag_includes?, tag_excludes?, lifecycle_in?, source_match? }
 */
export class EmailList extends Model {
  declare id: string;
  declare workspace_id: string;
  declare name: string;
  declare description: string | null;
  declare filter: {
    tag_includes?: string[];
    tag_excludes?: string[];
    lifecycle_in?: string[];
    source_match?: string;
  };
  declare created_by: string;
  declare created_at: Date;
  declare updated_at: Date;
}

export function defineEmailList(sequelize: Sequelize) {
  EmailList.init(
    {
      id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      workspace_id: { type: DataTypes.CHAR(36), allowNull: false },
      name: { type: DataTypes.STRING(255), allowNull: false },
      description: { type: DataTypes.STRING(1000), allowNull: true },
      filter: { type: DataTypes.JSON, allowNull: false },
      created_by: { type: DataTypes.CHAR(36), allowNull: false },
    },
    {
      sequelize,
      modelName: 'EmailList',
      tableName: 'email_lists',
      timestamps: true,
      underscored: true,
      indexes: [
        { name: 'uk_workspace_name', unique: true, fields: ['workspace_id', 'name'] },
        { name: 'idx_workspace', fields: ['workspace_id'] },
      ],
    },
  );
  return EmailList;
}
