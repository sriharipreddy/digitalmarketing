import type { Sequelize } from 'sequelize';
import bcrypt from 'bcrypt';
import type { Models } from '../models/index.js';
import pino from 'pino';

const logger = pino({ name: 'marketing-core:seeds' });

const DEFAULT_PERMISSION_FULL = JSON.stringify({ c: true, r: true, u: true, d: true });
const DEFAULT_PERMISSION_READ = JSON.stringify({ r: true });

/**
 * Idempotent seeding. Safe to run on every boot.
 * Creates: default plans, default roles + permissions, a dev platform admin
 *          in development mode.
 */
export async function seedInitialData(sequelize: Sequelize, models: Models): Promise<void> {
  await sequelize.transaction(async (t) => {
    await seedPlans(models, t);
    await seedDefaultRoles(models, t);
    if (process.env.NODE_ENV === 'development') {
      await seedDevAdmin(models, t);
    }
  });
}

async function seedPlans(models: Models, transaction: any) {
  const plans = [
    {
      slug: 'free',
      name: 'Free',
      price_monthly_gbp: 0,
      price_yearly_gbp: 0,
      features: { seo: true, content: true, social: true, email: true, crm: true, one_click_capture: false },
      limits: { keywords: 25, campaigns: 1, team_members: 1, email_subscribers: 500 },
      max_team_members: 1,
      max_clients: 0,
      is_agency_plan: false,
      display_order: 1,
    },
    {
      slug: 'starter',
      name: 'Starter',
      price_monthly_gbp: 29,
      price_yearly_gbp: 278,
      features: { seo: true, content: true, social: true, email: true, crm: true, one_click_capture: false },
      limits: { keywords: 100, campaigns: 5, team_members: 2, email_subscribers: 2500 },
      max_team_members: 2,
      max_clients: 0,
      is_agency_plan: false,
      display_order: 2,
    },
    {
      slug: 'pro',
      name: 'Pro',
      price_monthly_gbp: 79,
      price_yearly_gbp: 758,
      features: {
        seo: true,
        content: true,
        social: true,
        email: true,
        crm: true,
        one_click_capture: true,
        competitor_intel: true,
        influencers: true,
        affiliates: true,
        public_api: true,
      },
      limits: { keywords: 1000, campaigns: 25, team_members: 5, email_subscribers: 25000 },
      max_team_members: 5,
      max_clients: 0,
      is_agency_plan: false,
      display_order: 3,
    },
    {
      slug: 'agency',
      name: 'Agency',
      price_monthly_gbp: 249,
      price_yearly_gbp: 2390,
      features: { everything: true, white_label: true, client_portal: true, bulk_reports: true, api_access: true },
      limits: { keywords: 10000, campaigns: -1, team_members: 20, email_subscribers: 500000 },
      max_team_members: 20,
      max_clients: 25,
      is_agency_plan: true,
      display_order: 4,
    },
  ];

  for (const plan of plans) {
    await models.Plan.findOrCreate({
      where: { slug: plan.slug },
      defaults: plan as any,
      transaction,
    });
  }
  logger.info({ count: plans.length }, 'plans_seeded');
}

async function seedDefaultRoles(models: Models, transaction: any) {
  const roles = [
    { role_name: 'owner', description: 'Full access to workspace', is_default: true },
    { role_name: 'editor', description: 'Create + edit content; cannot delete or manage billing', is_default: true },
    { role_name: 'analyst', description: 'Read-only access to all analytics', is_default: true },
    { role_name: 'viewer', description: 'Read-only access to reports', is_default: true },
  ];

  const modules = [
    'workspace',
    'members',
    'roles',
    'billing',
    'seo_keywords',
    'seo_audits',
    'campaigns',
    'content',
    'social',
    'email',
    'crm',
    'analytics',
  ];

  for (const role of roles) {
    const [r] = await models.Role.findOrCreate({
      where: { role_name: role.role_name, workspace_id: null },
      defaults: role as any,
      transaction,
    });
    for (const mod of modules) {
      const access =
        role.role_name === 'owner'
          ? DEFAULT_PERMISSION_FULL
          : role.role_name === 'editor'
            ? JSON.stringify({ c: true, r: true, u: true })
            : role.role_name === 'analyst'
              ? DEFAULT_PERMISSION_READ
              : DEFAULT_PERMISSION_READ;
      await models.Permission.findOrCreate({
        where: { role_id: r.id, module_name: mod },
        defaults: { role_id: r.id, module_name: mod, access: JSON.parse(access) } as any,
        transaction,
      });
    }
  }
  logger.info({ count: roles.length }, 'roles_seeded');
}

async function seedDevAdmin(models: Models, transaction: any) {
  const email = 'admin@yourplatform.local';
  const existing = await models.User.findOne({ where: { user_email: email }, transaction });
  if (existing) return;

  const password_hash = await bcrypt.hash('AdminDev1234!', 10);
  await models.User.create(
    {
      full_name: 'Platform Admin',
      user_email: email,
      password_hash,
      type: 'platform_admin',
      status: 'active',
      email_verified: true,
    } as any,
    { transaction },
  );
  logger.info({ email }, 'dev_admin_seeded — login: admin@yourplatform.local / AdminDev1234!');
}
