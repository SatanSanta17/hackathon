'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

interface TeamInviteAcceptClientProps {
  token: string;
  teamName: string;
  hackathonTitle: string;
  hackathonSlug: string;
  isAuthenticated: boolean;
}

export function TeamInviteAcceptClient({
  token,
  teamName,
  hackathonTitle,
  hackathonSlug,
  isAuthenticated,
}: TeamInviteAcceptClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const callbackUrl = encodeURIComponent(`/team-invites/accept?token=${token}`);

  async function handleAccept() {
    setLoading(true);
    try {
      const res = await fetch('/api/team-invites/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message ?? 'Failed to accept invite.');
        return;
      }
      router.push(`/hackathons/${hackathonSlug}/teams/${data.teamId}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 shadow-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="font-heading text-2xl font-bold">You've been invited!</h1>
          <p className="text-sm text-muted-foreground">
            Join <span className="font-medium text-foreground">{teamName}</span> for{' '}
            <span className="font-medium text-foreground">{hackathonTitle}</span>
          </p>
        </div>

        {isAuthenticated ? (
          <Button className="w-full" onClick={handleAccept} disabled={loading}>
            {loading ? 'Accepting…' : 'Accept Invite'}
          </Button>
        ) : (
          <div className="space-y-3">
            <p className="text-center text-sm text-muted-foreground">
              Sign in or create an account to accept this invite.
            </p>
            <Button className="w-full" asChild>
              <Link href={`/login?callbackUrl=${callbackUrl}`}>Sign In</Link>
            </Button>
            <Button variant="outline" className="w-full" asChild>
              <Link href={`/signup?callbackUrl=${callbackUrl}`}>Create Account</Link>
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              After verifying your email, return to this link to accept the invite.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
