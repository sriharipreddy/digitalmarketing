import { DataTypes, Model, type Sequelize } from 'sequelize';

export type LocalProvider = 'gmb' | 'apple_maps' | 'bing_places' | 'yelp';
export type LocalListingStatus = 'pending_verification' | 'verified' | 'suspended' | 'disconnected';

export class LocalListing extends Model {
  declare id: string;
  declare workspace_id: string;
  declare provider: LocalProvider;
  declare provider_account_id: string;
  declare business_name: string;
  declare address_line1: string | null;
  declare address_line2: string | null;
  declare city: string | null;
  declare region: string | null;
  declare postal_code: string | null;
  declare country: string;
  declare phone: string | null;
  declare website_url: string | null;
  declare categories: string[] | null;
  declare hours: Record<string, unknown> | null;
  declare status: LocalListingStatus;
  declare last_sync_at: Date | null;
  declare created_at: Date;
  declare updated_at: Date;
}

export function defineLocalListing(sequelize: Sequelize) {
  LocalListing.init(
    {
      id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      workspace_id: { type: DataTypes.CHAR(36), allowNull: false },
      provider: { type: DataTypes.ENUM('gmb', 'apple_maps', 'bing_places', 'yelp'), allowNull: false },
      provider_account_id: { type: DataTypes.STRING(255), allowNull: false },
      business_name: { type: DataTypes.STRING(255), allowNull: false },
      address_line1: { type: DataTypes.STRING(255), allowNull: true },
      address_line2: { type: DataTypes.STRING(255), allowNull: true },
      city: { type: DataTypes.STRING(120), allowNull: true },
      region: { type: DataTypes.STRING(120), allowNull: true },
      postal_code: { type: DataTypes.STRING(20), allowNull: true },
      country: { type: DataTypes.CHAR(2), allowNull: false, defaultValue: 'US' },
      phone: { type: DataTypes.STRING(40), allowNull: true },
      website_url: { type: DataTypes.STRING(2000), allowNull: true },
      categories: { type: DataTypes.JSON, allowNull: true },
      hours: { type: DataTypes.JSON, allowNull: true },
      status: {
        type: DataTypes.ENUM('pending_verification', 'verified', 'suspended', 'disconnected'),
        allowNull: false,
        defaultValue: 'pending_verification',
      },
      last_sync_at: { type: DataTypes.DATE, allowNull: true },
    },
    {
      sequelize,
      modelName: 'LocalListing',
      tableName: 'seo_local_listings',
      timestamps: true,
      underscored: true,
      indexes: [
        { name: 'uk_workspace_provider_account', unique: true, fields: ['workspace_id', 'provider', 'provider_account_id'] },
        { name: 'idx_workspace_status', fields: ['workspace_id', 'status'] },
      ],
    },
  );
  return LocalListing;
}
