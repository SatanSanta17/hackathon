import { and, count, desc, eq, isNull } from 'drizzle-orm';

import { db } from '@/db';
import {
  hackathons,
  registrationFields,
  registrations,
  teamMembers,
  teams,
} from '@/db/schema';
import { users } from '@/db/schema/users';
import { tracks } from '@/db/schema/tracks';
import type { Registration, RegistrationField } from '@/db/schema';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RegistrationWithUser {
  id: string;
  hackathonId: string;
  userId: string;
  formData: Record<string, string> | null;
  isDiscoverable: boolean;
  registeredAt: Date;
  user: {
    name: string;
    email: string;
  };
  team: {
    id: string;
    name: string;
    trackName: string | null;
  } | null;
}

export interface DiscoverableParticipant {
  id: string;
  userId: string;
  formData: Record<string, string> | null;
  registeredAt: Date;
  user: {
    name: string;
    email: string;
    avatarUrl: string | null;
  };
}

// ---------------------------------------------------------------------------
// Create / Auto-Register
// ---------------------------------------------------------------------------

export async function createRegistration(
  hackathonId: string,
  userId: string,
  formData: Record<string, string> | null,
  isDiscoverable: boolean = true,
): Promise<Registration> {
  const existing = await getRegistrationByUserAndHackathon(userId, hackathonId);
  if (existing) {
    throw new Error('ALREADY_REGISTERED');
  }

  const [registration] = await db
    .insert(registrations)
    .values({ hackathonId, userId, formData, isDiscoverable })
    .returning();

  return registration;
}

export async function autoRegister(
  hackathonId: string,
  userId: string,
): Promise<void> {
  const existing = await getRegistrationByUserAndHackathon(userId, hackathonId);
  if (existing) return;

  await db.insert(registrations).values({
    hackathonId,
    userId,
    formData: null,
    isDiscoverable: true,
  });
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function getRegistrationByUserAndHackathon(
  userId: string,
  hackathonId: string,
): Promise<Registration | null> {
  const [registration] = await db
    .select()
    .from(registrations)
    .where(
      and(
        eq(registrations.userId, userId),
        eq(registrations.hackathonId, hackathonId),
        isNull(registrations.deletedAt),
      ),
    )
    .limit(1);

  return registration ?? null;
}

export async function getRegistrationsByHackathon(
  hackathonId: string,
): Promise<RegistrationWithUser[]> {
  const rows = await db
    .select({
      id: registrations.id,
      hackathonId: registrations.hackathonId,
      userId: registrations.userId,
      formData: registrations.formData,
      isDiscoverable: registrations.isDiscoverable,
      registeredAt: registrations.registeredAt,
      userName: users.name,
      userEmail: users.email,
      teamId: teams.id,
      teamName: teams.name,
      trackName: tracks.name,
    })
    .from(registrations)
    .innerJoin(users, eq(registrations.userId, users.id))
    .leftJoin(teamMembers, eq(teamMembers.userId, registrations.userId))
    .leftJoin(
      teams,
      and(
        eq(teams.id, teamMembers.teamId),
        eq(teams.hackathonId, hackathonId),
        isNull(teams.deletedAt),
      ),
    )
    .leftJoin(tracks, eq(tracks.id, teams.trackId))
    .where(
      and(
        eq(registrations.hackathonId, hackathonId),
        isNull(registrations.deletedAt),
      ),
    );

  return rows.map((row) => ({
    id: row.id,
    hackathonId: row.hackathonId,
    userId: row.userId,
    formData: row.formData as Record<string, string> | null,
    isDiscoverable: row.isDiscoverable,
    registeredAt: row.registeredAt,
    user: { name: row.userName, email: row.userEmail },
    team: row.teamId
      ? { id: row.teamId, name: row.teamName!, trackName: row.trackName ?? null }
      : null,
  }));
}

export async function getDiscoverableParticipants(
  hackathonId: string,
): Promise<DiscoverableParticipant[]> {
  const rows = await db
    .select({
      id: registrations.id,
      userId: registrations.userId,
      formData: registrations.formData,
      registeredAt: registrations.registeredAt,
      userName: users.name,
      userEmail: users.email,
      userAvatarUrl: users.avatarUrl,
    })
    .from(registrations)
    .innerJoin(users, eq(registrations.userId, users.id))
    .where(
      and(
        eq(registrations.hackathonId, hackathonId),
        eq(registrations.isDiscoverable, true),
        isNull(registrations.deletedAt),
      ),
    );

  // Filter out users who are currently on a team for this hackathon
  const withTeamCheck = await Promise.all(
    rows.map(async (row) => {
      const [membership] = await db
        .select({ id: teamMembers.id })
        .from(teamMembers)
        .innerJoin(teams, eq(teams.id, teamMembers.teamId))
        .where(
          and(
            eq(teamMembers.userId, row.userId),
            eq(teams.hackathonId, hackathonId),
            isNull(teams.deletedAt),
          ),
        )
        .limit(1);

      return membership ? null : row;
    }),
  );

  return withTeamCheck
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .map((row) => ({
      id: row.id,
      userId: row.userId,
      formData: row.formData as Record<string, string> | null,
      registeredAt: row.registeredAt,
      user: {
        name: row.userName,
        email: row.userEmail,
        avatarUrl: row.userAvatarUrl,
      },
    }));
}

export async function getRegistrationFields(
  hackathonId: string,
): Promise<RegistrationField[]> {
  return db
    .select()
    .from(registrationFields)
    .where(eq(registrationFields.hackathonId, hackathonId))
    .orderBy(registrationFields.order);
}

export async function upsertRegistrationFields(
  hackathonId: string,
  fields: Array<{
    label: string;
    fieldType: string;
    options: string[] | null;
    required: boolean;
    order: number;
  }>,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .delete(registrationFields)
      .where(eq(registrationFields.hackathonId, hackathonId));

    if (fields.length > 0) {
      await tx
        .insert(registrationFields)
        .values(fields.map((f) => ({ ...f, hackathonId })));
    }
  });
}

export async function getRegistrationCount(hackathonId: string): Promise<number> {
  const [result] = await db
    .select({ count: count() })
    .from(registrations)
    .where(
      and(
        eq(registrations.hackathonId, hackathonId),
        isNull(registrations.deletedAt),
      ),
    );

  return result?.count ?? 0;
}

// ---------------------------------------------------------------------------
// User-scoped (My Hackathons)
// ---------------------------------------------------------------------------

export interface UserHackathonSummary {
  registrationId: string;
  hackathonId: string;
  registeredAt: Date;
  formData: Record<string, string> | null;
  hackathon: {
    title: string;
    slug: string;
    status: string;
    coverImageKey: string | null;
    requiresApproval: boolean;
  };
  team: {
    id: string;
    name: string;
    adminStatus: string;
    memberCount: number;
  } | null;
}

export async function getRegistrationsByUser(
  userId: string,
): Promise<UserHackathonSummary[]> {
  const rows = await db
    .select({
      registrationId: registrations.id,
      hackathonId: registrations.hackathonId,
      registeredAt: registrations.registeredAt,
      formData: registrations.formData,
      hackathonTitle: hackathons.title,
      hackathonSlug: hackathons.slug,
      hackathonStatus: hackathons.status,
      hackathonCoverImageKey: hackathons.coverImageKey,
      hackathonRequiresApproval: hackathons.requiresApproval,
    })
    .from(registrations)
    .innerJoin(hackathons, eq(registrations.hackathonId, hackathons.id))
    .where(
      and(
        eq(registrations.userId, userId),
        isNull(registrations.deletedAt),
        isNull(hackathons.deletedAt),
      ),
    )
    .orderBy(desc(registrations.registeredAt));

  return Promise.all(
    rows.map(async (row) => {
      // Inline team lookup to avoid circular import with team-service
      const [teamRow] = await db
        .select({
          teamId: teamMembers.teamId,
          teamName: teams.name,
          adminStatus: teams.adminStatus,
        })
        .from(teamMembers)
        .innerJoin(teams, eq(teams.id, teamMembers.teamId))
        .where(
          and(
            eq(teamMembers.userId, userId),
            eq(teams.hackathonId, row.hackathonId),
            isNull(teams.deletedAt),
          ),
        )
        .limit(1);

      let teamWithCount: UserHackathonSummary['team'] = null;
      if (teamRow) {
        const [{ memberCount }] = await db
          .select({ memberCount: count() })
          .from(teamMembers)
          .where(eq(teamMembers.teamId, teamRow.teamId));

        teamWithCount = {
          id: teamRow.teamId,
          name: teamRow.teamName,
          adminStatus: teamRow.adminStatus,
          memberCount,
        };
      }

      return {
        registrationId: row.registrationId,
        hackathonId: row.hackathonId,
        registeredAt: row.registeredAt,
        formData: row.formData as Record<string, string> | null,
        hackathon: {
          title: row.hackathonTitle,
          slug: row.hackathonSlug,
          status: row.hackathonStatus,
          coverImageKey: row.hackathonCoverImageKey,
          requiresApproval: row.hackathonRequiresApproval,
        },
        team: teamWithCount,
      };
    }),
  );
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export async function updateRegistration(
  registrationId: string,
  data: { formData?: Record<string, string> | null; isDiscoverable?: boolean },
): Promise<Registration> {
  const [updated] = await db
    .update(registrations)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(registrations.id, registrationId))
    .returning();

  if (!updated) throw new Error('REGISTRATION_NOT_FOUND');
  return updated;
}
