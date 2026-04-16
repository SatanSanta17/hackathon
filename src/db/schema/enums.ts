import { pgEnum } from 'drizzle-orm/pg-core';

export const platformRoleEnum = pgEnum('platform_role', ['user', 'super_admin']);
export const orgRoleEnum = pgEnum('org_role', ['org_admin', 'member']);
