import { eq, isNull, count } from 'drizzle-orm';

import { db } from '@/db';
import { organizations, orgMemberships, users } from '@/db/schema';

/**
 * List all organizations with member counts.
 * For the super admin panel. Excludes soft-deleted orgs.
 */
export async function listOrganizations() {
  console.log('[admin-service] listOrganizations');

  const orgs = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      createdAt: organizations.createdAt,
      memberCount: count(orgMemberships.id),
    })
    .from(organizations)
    .leftJoin(
      orgMemberships,
      eq(organizations.id, orgMemberships.orgId),
    )
    .where(isNull(organizations.deletedAt))
    .groupBy(organizations.id)
    .orderBy(organizations.createdAt);

  return orgs;
}

/**
 * List all users for the super admin panel.
 * Excludes soft-deleted users. Ordered by most recent first.
 */
export async function listUsers() {
  console.log('[admin-service] listUsers');

  const allUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      platformRole: users.platformRole,
      emailVerified: users.emailVerified,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(isNull(users.deletedAt))
    .orderBy(users.createdAt);

  return allUsers;
}
