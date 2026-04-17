import { notFound } from 'next/navigation';

import { auth } from '@/lib/auth/auth';
import { getTeamInviteByToken } from '@/lib/services/team-service';

import { TeamInviteAcceptClient } from './_components/team-invite-accept-client';

function InvalidInvitePage({ reason }: { reason: 'not_found' | 'expired' | 'already_accepted' }) {
  const copy = {
    not_found: {
      title: 'Invite Not Found',
      body: 'This invite link is invalid or does not exist.',
    },
    expired: {
      title: 'Invite Expired',
      body: 'This invite has expired. Ask the team lead to re-invite you.',
    },
    already_accepted: {
      title: 'Invite Already Used',
      body: 'This invite has already been accepted.',
    },
  }[reason];

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 shadow-sm text-center space-y-3">
        <h1 className="font-heading text-2xl font-bold">{copy.title}</h1>
        <p className="text-sm text-muted-foreground">{copy.body}</p>
      </div>
    </div>
  );
}

export default async function TeamInviteAcceptPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) notFound();

  const invite = await getTeamInviteByToken(token);

  if (!invite) return <InvalidInvitePage reason="not_found" />;
  if (invite.expiresAt < new Date()) return <InvalidInvitePage reason="expired" />;
  if (invite.acceptedAt) return <InvalidInvitePage reason="already_accepted" />;

  const session = await auth();

  return (
    <TeamInviteAcceptClient
      token={token}
      teamName={invite.teamName}
      hackathonTitle={invite.hackathonTitle}
      hackathonSlug={invite.hackathonSlug}
      isAuthenticated={!!session?.user?.id}
    />
  );
}
