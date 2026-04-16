'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

export function VerificationBanner() {
  const { data: session } = useSession();
  const [isSending, setIsSending] = useState(false);

  // Don't render if no session or already verified
  if (!session?.user || session.user.isEmailVerified) {
    return null;
  }

  async function handleResend() {
    setIsSending(true);

    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
      });

      const body = await res.json();

      if (res.ok) {
        toast.success('Verification email sent. Check your inbox.');
      } else {
        toast.error(body.message ?? 'Failed to send verification email.');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div
      role="alert"
      className="flex items-center gap-3 border-b border-border bg-muted px-4 py-3 text-sm text-muted-foreground"
    >
      <AlertTriangle className="size-4 shrink-0" />
      <p className="flex-1">
        Please verify your email to unlock all features.
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={handleResend}
        disabled={isSending}
        className="shrink-0"
      >
        {isSending ? 'Sending...' : 'Resend verification email'}
      </Button>
    </div>
  );
}
