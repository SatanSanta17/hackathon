import crypto from 'crypto';
import { eq, and, isNull, count, gt } from 'drizzle-orm';

import { db } from '@/db';
import { organizations, orgMemberships, orgInvites, users } from '@/db/schema';
import { getEmailService } from '@/lib/email';
import { orgInviteEmail } from '@/lib/email/templates';
import { AUTH_CONSTANTS } from '@/lib/auth/constants';
import { ERR } from '@/lib/constants/error-codes';
import { ORG_ROLE } from '@/lib/constants/enums';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

// ---------------------------------------------------------------------------
// Create Organization
// ---------------------------------------------------------------------------

/**
 * Create a new organization and add the creator as org_admin.
 * 1. Check slug uniqueness
 * 2. Insert organization record
 * 3. Insert org_membership (org_admin role)
 * 4. Return the org
 */
export async function createOrg(params: {
  name: string;
  slug: string;
  userId: string;
}): Promise<{ success: boolean; org?: { id: string; slug: string }; error?: string }> {
  console.log('[org-service] createOrg:', { slug: params.slug, userId: params.userId });

  try {
    // 1. Check slug uniqueness
    const existingOrg = await db.query.organizations.findFirst({
      where: and(
        eq(organizations.slug, params.slug),
        isNull(organizations.deletedAt),
      ),
    });

    if (existingOrg) {
      console.log('[org-service] createOrg: slug already taken');
      return { success: false, error: ERR.SLUG_TAKEN };
    }

    // 2. Insert organization
    const [newOrg] = await db
      .insert(organizations)
      .values({
        name: params.name,
        slug: params.slug,
      })
      .returning({ id: organizations.id, slug: organizations.slug });

    // 3. Add creator as org_admin
    await db.insert(orgMemberships).values({
      userId: params.userId,
      orgId: newOrg.id,
      role: 'org_admin',
      joinedAt: new Date(),
    });

    console.log('[org-service] createOrg successful:', { orgId: newOrg.id, slug: newOrg.slug });
    return { success: true, org: { id: newOrg.id, slug: newOrg.slug } };
  } catch (err) {
    console.error('[org-service] createOrg error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Something went wrong',
    };
  }
}

// ---------------------------------------------------------------------------
// Get Org by Slug
// ---------------------------------------------------------------------------

/**
 * Find an organization by slug. Excludes soft-deleted orgs.
 */
export async function getOrgBySlug(slug: string) {
  return db.query.organizations.findFirst({
    where: and(
      eq(organizations.slug, slug),
      isNull(organizations.deletedAt),
    ),
  });
}

// ---------------------------------------------------------------------------
// Get User's Organizations
// ---------------------------------------------------------------------------

/**
 * Return all organizations a user belongs to (via active memberships).
 */
export async function getUserOrgs(userId: string) {
  console.log('[org-service] getUserOrgs:', { userId });

  const memberships = await db
    .select({
      membership: orgMemberships,
      org: organizations,
    })
    .from(orgMemberships)
    .innerJoin(organizations, eq(orgMemberships.orgId, organizations.id))
    .where(
      and(
        eq(orgMemberships.userId, userId),
        isNull(orgMemberships.deletedAt),
        isNull(organizations.deletedAt),
      ),
    );

  return memberships.map((row) => ({
    org: row.org,
    role: row.membership.role,
  }));
}

// ---------------------------------------------------------------------------
// Invite Member
// ---------------------------------------------------------------------------

/**
 * Send an org invite to an email address.
 * 1. Check if email is already a member
 * 2. Check if a pending invite already exists
 * 3. Generate secure token (SHA-256 stored)
 * 4. Insert org_invites record
 * 5. Send invite email
 */
export async function inviteMember(params: {
  orgId: string;
  email: string;
  role: 'org_admin' | 'member';
  invitedByUserId: string;
  inviterName: string;
  orgName: string;
}): Promise<{ success: boolean; error?: string }> {
  const email = params.email.toLowerCase();
  console.log('[org-service] inviteMember:', { orgId: params.orgId, email, role: params.role });

  try {
    // 1. Check if already a member
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existingUser) {
      const existingMembership = await db.query.orgMemberships.findFirst({
        where: and(
          eq(orgMemberships.userId, existingUser.id),
          eq(orgMemberships.orgId, params.orgId),
          isNull(orgMemberships.deletedAt),
        ),
      });

      if (existingMembership) {
        console.log('[org-service] inviteMember: user is already a member');
        return { success: false, error: ERR.ALREADY_MEMBER };
      }
    }

    // 2. Check for pending invite
    const pendingInvite = await db.query.orgInvites.findFirst({
      where: and(
        eq(orgInvites.orgId, params.orgId),
        eq(orgInvites.email, email),
        isNull(orgInvites.acceptedAt),
        gt(orgInvites.expiresAt, new Date()),
      ),
    });

    if (pendingInvite) {
      console.log('[org-service] inviteMember: pending invite already exists');
      return { success: false, error: ERR.INVITE_PENDING };
    }

    // 3. Generate secure token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    // 4. Insert invite record
    const expiresAt = new Date(
      Date.now() + AUTH_CONSTANTS.ORG_INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    );

    await db.insert(orgInvites).values({
      orgId: params.orgId,
      email,
      role: params.role,
      token: hashedToken,
      invitedBy: params.invitedByUserId,
      expiresAt,
    });

    // 5. Send invite email
    const acceptUrl = `${APP_URL}/invite/accept?token=${rawToken}`;
    const template = orgInviteEmail({
      inviterName: params.inviterName,
      orgName: params.orgName,
      role: params.role,
      acceptUrl,
    });
    const emailResult = await getEmailService().send({ to: email, ...template });

    if (!emailResult.success) {
      console.error('[org-service] inviteMember: email failed:', emailResult.error);
      // Invite is created but email failed — admin can view pending invites
    }

    console.log('[org-service] inviteMember successful:', { email, orgId: params.orgId });
    return { success: true };
  } catch (err) {
    console.error('[org-service] inviteMember error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Something went wrong',
    };
  }
}

// ---------------------------------------------------------------------------
// Accept Invite
// ---------------------------------------------------------------------------

/**
 * Accept an org invite.
 * 1. Hash raw token and find matching invite
 * 2. Check user isn't already a member (idempotent)
 * 3. Insert org_membership
 * 4. Mark invite as accepted
 */
export async function acceptInvite(params: {
  rawToken: string;
  userId: string;
}): Promise<{ success: boolean; orgSlug?: string; error?: string }> {
  console.log('[org-service] acceptInvite:', { userId: params.userId });

  try {
    // 1. Find matching invite
    const hashedToken = crypto.createHash('sha256').update(params.rawToken).digest('hex');

    const invite = await db.query.orgInvites.findFirst({
      where: and(
        eq(orgInvites.token, hashedToken),
        isNull(orgInvites.acceptedAt),
        gt(orgInvites.expiresAt, new Date()),
      ),
    });

    if (!invite) {
      console.log('[org-service] acceptInvite: invalid or expired token');
      return { success: false, error: ERR.INVALID_TOKEN };
    }

    // Get org for the slug
    const org = await db.query.organizations.findFirst({
      where: and(
        eq(organizations.id, invite.orgId),
        isNull(organizations.deletedAt),
      ),
    });

    if (!org) {
      console.log('[org-service] acceptInvite: organization not found');
      return { success: false, error: ERR.ORG_NOT_FOUND };
    }

    // 2. Check if already a member (idempotent)
    const existingMembership = await db.query.orgMemberships.findFirst({
      where: and(
        eq(orgMemberships.userId, params.userId),
        eq(orgMemberships.orgId, invite.orgId),
        isNull(orgMemberships.deletedAt),
      ),
    });

    if (existingMembership) {
      // Already a member — mark invite accepted and return
      await db
        .update(orgInvites)
        .set({ acceptedAt: new Date(), updatedAt: new Date() })
        .where(eq(orgInvites.id, invite.id));

      console.log('[org-service] acceptInvite: user already a member, invite marked accepted');
      return { success: true, orgSlug: org.slug };
    }

    // 3. Insert membership
    await db.insert(orgMemberships).values({
      userId: params.userId,
      orgId: invite.orgId,
      role: invite.role,
      invitedAt: invite.createdAt,
      joinedAt: new Date(),
    });

    // 4. Mark invite as accepted
    await db
      .update(orgInvites)
      .set({ acceptedAt: new Date(), updatedAt: new Date() })
      .where(eq(orgInvites.id, invite.id));

    console.log('[org-service] acceptInvite successful:', { orgSlug: org.slug });
    return { success: true, orgSlug: org.slug };
  } catch (err) {
    console.error('[org-service] acceptInvite error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Something went wrong',
    };
  }
}

// ---------------------------------------------------------------------------
// Get Org Members
// ---------------------------------------------------------------------------

/**
 * Return all active members of an organization with user details.
 */
export async function getOrgMembers(orgId: string) {
  console.log('[org-service] getOrgMembers:', { orgId });

  const members = await db
    .select({
      membership: orgMemberships,
      user: {
        id: users.id,
        name: users.name,
        email: users.email,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(orgMemberships)
    .innerJoin(users, eq(orgMemberships.userId, users.id))
    .where(
      and(
        eq(orgMemberships.orgId, orgId),
        isNull(orgMemberships.deletedAt),
      ),
    );

  return members;
}

// ---------------------------------------------------------------------------
// Change Member Role
// ---------------------------------------------------------------------------

/**
 * Change a member's role within an organization.
 * Prevents demoting the last org_admin.
 */
export async function changeMemberRole(params: {
  membershipId: string;
  orgId: string;
  newRole: 'org_admin' | 'member';
}): Promise<{ success: boolean; error?: string }> {
  console.log('[org-service] changeMemberRole:', {
    membershipId: params.membershipId,
    orgId: params.orgId,
    newRole: params.newRole,
  });

  try {
    // Find the membership
    const membership = await db.query.orgMemberships.findFirst({
      where: and(
        eq(orgMemberships.id, params.membershipId),
        eq(orgMemberships.orgId, params.orgId),
        isNull(orgMemberships.deletedAt),
      ),
    });

    if (!membership) {
      console.log('[org-service] changeMemberRole: membership not found');
      return { success: false, error: ERR.MEMBERSHIP_NOT_FOUND };
    }

    // If demoting from org_admin, check this isn't the last one
    if (membership.role === ORG_ROLE.ADMIN && params.newRole === ORG_ROLE.MEMBER) {
      const [adminCount] = await db
        .select({ value: count() })
        .from(orgMemberships)
        .where(
          and(
            eq(orgMemberships.orgId, params.orgId),
            eq(orgMemberships.role, 'org_admin'),
            isNull(orgMemberships.deletedAt),
          ),
        );

      if (adminCount.value <= 1) {
        console.log('[org-service] changeMemberRole: cannot demote last admin');
        return { success: false, error: ERR.LAST_ADMIN };
      }
    }

    // Update role
    await db
      .update(orgMemberships)
      .set({ role: params.newRole, updatedAt: new Date() })
      .where(eq(orgMemberships.id, params.membershipId));

    console.log('[org-service] changeMemberRole successful');
    return { success: true };
  } catch (err) {
    console.error('[org-service] changeMemberRole error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Something went wrong',
    };
  }
}

// ---------------------------------------------------------------------------
// Remove Member
// ---------------------------------------------------------------------------

/**
 * Soft-delete an org membership. Prevents removing the last org_admin.
 */
export async function removeMember(params: {
  membershipId: string;
  orgId: string;
}): Promise<{ success: boolean; error?: string }> {
  console.log('[org-service] removeMember:', {
    membershipId: params.membershipId,
    orgId: params.orgId,
  });

  try {
    // Find the membership
    const membership = await db.query.orgMemberships.findFirst({
      where: and(
        eq(orgMemberships.id, params.membershipId),
        eq(orgMemberships.orgId, params.orgId),
        isNull(orgMemberships.deletedAt),
      ),
    });

    if (!membership) {
      console.log('[org-service] removeMember: membership not found');
      return { success: false, error: ERR.MEMBERSHIP_NOT_FOUND };
    }

    // If removing an org_admin, check this isn't the last one
    if (membership.role === ORG_ROLE.ADMIN) {
      const [adminCount] = await db
        .select({ value: count() })
        .from(orgMemberships)
        .where(
          and(
            eq(orgMemberships.orgId, params.orgId),
            eq(orgMemberships.role, 'org_admin'),
            isNull(orgMemberships.deletedAt),
          ),
        );

      if (adminCount.value <= 1) {
        console.log('[org-service] removeMember: cannot remove last admin');
        return { success: false, error: ERR.LAST_ADMIN };
      }
    }

    // Soft-delete membership
    await db
      .update(orgMemberships)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(orgMemberships.id, params.membershipId));

    console.log('[org-service] removeMember successful');
    return { success: true };
  } catch (err) {
    console.error('[org-service] removeMember error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Something went wrong',
    };
  }
}

// ---------------------------------------------------------------------------
// Get Pending Invites for User
// ---------------------------------------------------------------------------

/**
 * Find non-expired, non-accepted invites matching an email.
 * Used to show pending invites after login.
 */
export async function getPendingInvitesForUser(email: string) {
  console.log('[org-service] getPendingInvitesForUser:', { email });

  const invites = await db
    .select({
      invite: orgInvites,
      org: organizations,
    })
    .from(orgInvites)
    .innerJoin(organizations, eq(orgInvites.orgId, organizations.id))
    .where(
      and(
        eq(orgInvites.email, email.toLowerCase()),
        isNull(orgInvites.acceptedAt),
        gt(orgInvites.expiresAt, new Date()),
        isNull(organizations.deletedAt),
      ),
    );

  return invites;
}

// ---------------------------------------------------------------------------
// Check User Org Role
// ---------------------------------------------------------------------------

/**
 * Return a user's role in an org, or null if not a member.
 * Used by RBAC checks.
 */
export async function checkUserOrgRole(params: {
  userId: string;
  orgId: string;
}): Promise<{ role: string } | null> {
  const membership = await db.query.orgMemberships.findFirst({
    where: and(
      eq(orgMemberships.userId, params.userId),
      eq(orgMemberships.orgId, params.orgId),
      isNull(orgMemberships.deletedAt),
    ),
  });

  if (!membership) return null;
  return { role: membership.role };
}
