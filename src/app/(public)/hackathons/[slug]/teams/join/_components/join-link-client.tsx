'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

interface JoinLinkClientProps {
  code: string;
  team: { id: string; name: string; hackathonId: string; memberCount: number; maxSize: number; isOpen: boolean };
  hackathonSlug: string;
  hackathonTitle: string;
  isAuthenticated: boolean;
}

export function JoinLinkClient({
  code,
  team,
  hackathonSlug,
  hackathonTitle,
  isAuthenticated,
}: JoinLinkClientProps) {
  const [loading, setLoading] = useState(false);
  const [requested, setRequested] = useState(false);

  const isFull = team.maxSize > 0 && team.memberCount >= team.maxSize;
  const callbackUrl = encodeURIComponent(`/hackathons/${hackathonSlug}/teams/join?code=${code}`);

  async function handleRequest() {
    setLoading(true);
    try {
      const res = await fetch(`/api/hackathons/${team.hackathonId}/teams/${team.id}/join-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryPoint: 'link' }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message ?? 'Failed to send request.');
        return;
      }
      toast.success('Request sent! The team lead will review your request.');
      setRequested(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 shadow-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="font-heading text-2xl font-bold">{team.name}</h1>
          <p className="text-sm text-muted-foreground">{hackathonTitle}</p>
        </div>

        <div className="rounded-lg bg-muted/50 p-4 text-center text-sm text-muted-foreground">
          {team.memberCount} / {team.maxSize} members
        </div>

        {!team.isOpen ? (
          <p className="text-center text-sm text-muted-foreground">
            This team is no longer accepting members.
          </p>
        ) : isFull ? (
          <p className="text-center text-sm text-muted-foreground">
            This team is full.
          </p>
        ) : requested ? (
          <p className="text-center text-sm text-green-700 font-medium">
            Request sent! The team lead will review your request.
          </p>
        ) : isAuthenticated ? (
          <Button className="w-full" onClick={handleRequest} disabled={loading}>
            {loading ? 'Sending…' : 'Request to Join'}
          </Button>
        ) : (
          <div className="space-y-3">
            <p className="text-center text-sm text-muted-foreground">
              Sign in to request to join this team.
            </p>
            <Button className="w-full" asChild>
              <Link href={`/login?callbackUrl=${callbackUrl}`}>Sign In</Link>
            </Button>
            <Button variant="outline" className="w-full" asChild>
              <Link href={`/signup?callbackUrl=${callbackUrl}`}>Create Account</Link>
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              After verifying your email, return to this link to request to join.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
