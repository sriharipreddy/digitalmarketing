import { DataTypes, Model, type Sequelize } from 'sequelize';

export class Contact extends Model {
  declare id: string;
  declare workspace_id: string;
  declare email: string | null;
  declare first_name: string | null;
  declare last_name: string | null;
  declare phone: string | null;
  declare company: string | null;
  declare lifecycle_stage: 'subscriber' | 'lead' | 'mql' | 'sql' | 'customer' | 'evangelist' | 'churned';
  declare source: string | null;
  declare lead_score: number;
  declare tags: string[] | null;
  declare custom_fields: Record<string, unknown> | null;
  declare unsubscribed: boolean;
  declare unsubscribed_at: Date | null;
  declare created_at: Date;
  declare updated_at: Date;
}

export function defineContact(sequelize: Sequelize) {
  Contact.init(
    {
      id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      workspace_id: { type: DataTypes.CHAR(36), allowNull: false },
      email: { type: DataTypes.STRING(255), allowNull: true },
      first_name: { type: DataTypes.STRING(100), allowNull: true },
      last_name: { type: DataTypes.STRING(100), allowNull: true },
      phone: { type: DataTypes.STRING(50), allowNull: true },
      company: { type: DataTypes.STRING(255), allowNull: true },
      lifecycle_stage: {
        type: DataTypes.ENUM('subscriber', 'lead', 'mql', 'sql', 'customer', 'evangelist', 'churned'),
        allowNull: false,
        defaultValue: 'subscriber',
      },
      source: { type: DataTypes.STRING(64), allowNull: true },
      lead_score: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      tags: { type: DataTypes.JSON, allowNull: true },
      custom_fields: { type: DataTypes.JSON, allowNull: true },
      unsubscribed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      unsubscribed_at: { type: DataTypes.DATE, allowNull: true },
    },
    {
      sequelize,
      modelName: 'Contact',
      tableName: 'crm_contacts',
      timestamps: true,
      underscored: true,
      indexes: [
        { name: 'uk_workspace_email', unique: true, fields: ['workspace_id', 'email'] },
        { name: 'idx_workspace', fields: ['workspace_id'] },
        { name: 'idx_lifecycle', fields: ['workspace_id', 'lifecycle_stage'] },
        { name: 'idx_lead_score', fields: ['workspace_id', 'lead_score'] },
      ],
    },
  );
  return Contact;
}
