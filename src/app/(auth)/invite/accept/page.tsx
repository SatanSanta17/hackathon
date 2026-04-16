'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { CheckCircle2, XCircle, Loader2, Mail, ShieldAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SessionProvider } from '@/components/providers/session-provider';

function InviteAcceptContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const token = searchParams.get('token');

  const [state, setState] = useState<'loading' | 'success' | 'error' | 'not-logged-in' | 'unverified'>('loading');
  const [message, setMessage] = useState('');
  const [orgSlug, setOrgSlug] = useState<string | null>(null);
  const hasAttempted = useRef(false);

  useEffect(() => {
    if (sessionStatus === 'loading') return;
    if (hasAttempted.current) return;

    // No token in URL
    if (!token) {
      setState('error');
      setMessage('No invitation token found.');
      hasAttempted.current = true;
      return;
    }

    // Not logged in
    if (!session?.user) {
      setState('not-logged-in');
      hasAttempted.current = true;
      return;
    }

    // Logged in but unverified
    if (!session.user.isEmailVerified) {
      setState('unverified');
      hasAttempted.current = true;
      return;
    }

    // Logged in and verified — accept the invite
    hasAttempted.current = true;
    acceptInvite(token);
  }, [sessionStatus, session, token]);

  async function acceptInvite(inviteToken: string) {
    try {
      const res = await fetch('/api/invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: inviteToken }),
      });

      const body = await res.json();

      if (res.ok) {
        setState('success');
        setMessage(body.message ?? 'You have joined the organization.');
        setOrgSlug(body.orgSlug ?? null);
      } else {
        setState('error');
        setMessage(body.message ?? 'Failed to accept invitation.');
      }
    } catch {
      setState('error');
      setMessage('Network error. Please try again.');
    }
  }

  // Loading state
  if (state === 'loading') {
    return (
      <Card className="w-full">
        <CardContent className="flex flex-col items-center gap-4 py-8">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Processing your invitation...
          </p>
        </CardContent>
      </Card>
    );
  }

  // Not logged in
  if (state === 'not-logged-in') {
    const callbackUrl = encodeURIComponent(
      `/invite/accept?token=${token}`,
    );
    return (
      <Card className="w-full">
        <CardHeader className="items-center">
          <Mail className="size-8 text-primary" />
          <CardTitle className="text-center">Log in to accept</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            You need to be logged in to accept this invitation.
          </p>
          <Button asChild className="w-full">
            <Link href={`/login?callbackUrl=${callbackUrl}`}>
              Log in
            </Link>
          </Button>
          <p className="text-xs text-muted-foreground">
            Don't have an account?{' '}
            <Link href="/signup" className="text-primary underline">
              Sign up
            </Link>
          </p>
        </CardContent>
      </Card>
    );
  }

  // Unverified
  if (state === 'unverified') {
    return (
      <Card className="w-full">
        <CardHeader className="items-center">
          <ShieldAlert className="size-8 text-muted-foreground" />
          <CardTitle className="text-center">Verify your email</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            Please verify your email address before accepting this invitation.
          </p>
          <Button variant="outline" asChild className="w-full">
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Success
  if (state === 'success') {
    return (
      <Card className="w-full">
        <CardHeader className="items-center">
          <CheckCircle2 className="size-8 text-primary" />
          <CardTitle className="text-center">Invitation accepted</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">{message}</p>
          <Button asChild className="w-full">
            <Link href={orgSlug ? `/dashboard/${orgSlug}` : '/dashboard'}>
              Go to Dashboard
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Error
  return (
    <Card className="w-full">
      <CardHeader className="items-center">
        <XCircle className="size-8 text-destructive" />
        <CardTitle className="text-center">Invitation failed</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-center">
        <p className="text-sm text-muted-foreground">{message}</p>
        <Button variant="outline" asChild className="w-full">
          <Link href="/dashboard">Go to Dashboard</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export default function InviteAcceptPage() {
  return (
    <SessionProvider>
      <InviteAcceptContent />
    </SessionProvider>
  );
}
