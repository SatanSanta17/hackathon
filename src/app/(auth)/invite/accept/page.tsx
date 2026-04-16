'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { CheckCircle2, XCircle, Loader2, Mail, ShieldAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SessionProvider } from '@/components/providers/session-provider';

function InviteAcceptContent() {
  const searchParams = useSearchParams();
  const { data: session, status: sessionStatus } = useSession();
  const token = searchParams.get('token');

  // Async result state — only set after the API call resolves
  const [apiResult, setApiResult] = useState<{
    status: 'idle' | 'success' | 'error';
    message: string;
    orgSlug: string | null;
  }>({ status: 'idle', message: '', orgSlug: null });
  const hasAttempted = useRef(false);

  // Derive synchronous display state from session + token (no setState needed)
  const derivedState: 'loading' | 'error' | 'not-logged-in' | 'unverified' | 'accepting' =
    !token
      ? 'error'
      : sessionStatus === 'loading'
        ? 'loading'
        : !session?.user
          ? 'not-logged-in'
          : !session.user.isEmailVerified
            ? 'unverified'
            : 'accepting';

  // Combine: if the API has resolved, use that; otherwise use derived state
  const state =
    apiResult.status === 'success'
      ? 'success'
      : apiResult.status === 'error'
        ? 'error'
        : derivedState === 'error'
          ? 'error'
          : derivedState;
  const message =
    apiResult.message || (!token ? 'No invitation token found.' : '');
  const orgSlug = apiResult.orgSlug;

  useEffect(() => {
    if (derivedState !== 'accepting') return;
    if (hasAttempted.current) return;
    hasAttempted.current = true;

    async function acceptInvite() {
      try {
        const res = await fetch('/api/invite/accept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const body = await res.json();

        if (res.ok) {
          setApiResult({
            status: 'success',
            message: body.message ?? 'You have joined the organization.',
            orgSlug: body.orgSlug ?? null,
          });
        } else {
          setApiResult({
            status: 'error',
            message: body.message ?? 'Failed to accept invitation.',
            orgSlug: null,
          });
        }
      } catch {
        setApiResult({
          status: 'error',
          message: 'Network error. Please try again.',
          orgSlug: null,
        });
      }
    }

    acceptInvite();
  }, [derivedState, token]);

  // Loading / accepting state
  if (state === 'loading' || state === 'accepting') {
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
            Don&apos;t have an account?{' '}
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
      <Suspense
        fallback={
          <Card className="w-full">
            <CardContent className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Processing your invitation...
              </p>
            </CardContent>
          </Card>
        }
      >
        <InviteAcceptContent />
      </Suspense>
    </SessionProvider>
  );
}
