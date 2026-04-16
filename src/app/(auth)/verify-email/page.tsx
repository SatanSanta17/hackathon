'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';

type VerifyState = 'loading' | 'success' | 'error';

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [state, setState] = useState<VerifyState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const hasRun = useRef(false);

  useEffect(() => {
    // Prevent double-run in React strict mode
    if (hasRun.current) return;
    hasRun.current = true;

    if (!token) {
      setState('error');
      setErrorMessage('No verification token provided.');
      return;
    }

    async function verify() {
      try {
        const res = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        if (res.ok) {
          setState('success');
        } else {
          setState('error');
          const body = await res.json();
          setErrorMessage(body.message ?? 'Verification failed.');
        }
      } catch {
        setState('error');
        setErrorMessage('Network error. Please try again.');
      }
    }

    verify();
  }, [token]);

  return (
    <Card>
      <CardContent className="space-y-4 text-center">
        {state === 'loading' && (
          <>
            <Loader2 className="mx-auto size-10 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Verifying your email...
            </p>
          </>
        )}

        {state === 'success' && (
          <>
            <CheckCircle className="mx-auto size-10 text-emerald-600" />
            <div className="space-y-1">
              <h2 className="text-lg font-heading font-semibold text-foreground">
                Email verified!
              </h2>
              <p className="text-sm text-muted-foreground">
                Your email has been verified successfully.
              </p>
            </div>
            <Link
              href="/dashboard"
              className="inline-block text-sm text-primary underline-offset-4 hover:underline"
            >
              Go to dashboard
            </Link>
          </>
        )}

        {state === 'error' && (
          <>
            <XCircle className="mx-auto size-10 text-destructive" />
            <div className="space-y-1">
              <h2 className="text-lg font-heading font-semibold text-foreground">
                Verification failed
              </h2>
              <p className="text-sm text-muted-foreground">
                {errorMessage || 'This verification link is invalid or has expired.'}
              </p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Link
                href="/login"
                className="text-sm text-primary underline-offset-4 hover:underline"
              >
                Go to login
              </Link>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
