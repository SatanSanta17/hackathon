'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { LoginForm } from '@/app/(auth)/login/_components/login-form';
import { SignUpForm } from '@/app/(auth)/signup/_components/signup-form';
import { RegistrationForm } from './registration-form';
import type { RegistrationField } from '@/db/schema';

type ModalMode = 'auth' | 'auth_signup_sent' | 'register' | 'success';

interface AuthRegistrationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hackathonId: string;
  hackathonSlug: string;
  hackathonTitle: string;
  registrationFields: RegistrationField[];
  initialMode: 'auth' | 'register';
  userName: string | null;
  userEmail: string | null;
}

export function AuthRegistrationModal({
  open,
  onOpenChange,
  hackathonId,
  hackathonSlug,
  hackathonTitle,
  registrationFields,
  initialMode,
  userName,
  userEmail,
}: AuthRegistrationModalProps) {
  const [mode, setMode] = useState<ModalMode>(initialMode);

  useEffect(() => {
    if (open) setMode(initialMode);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {mode === 'auth' && (
          <>
            <DialogHeader>
              <DialogTitle>Join {hackathonTitle}</DialogTitle>
            </DialogHeader>
            <Tabs defaultValue="login">
              <TabsList className="w-full">
                <TabsTrigger value="login" className="flex-1">Sign In</TabsTrigger>
                <TabsTrigger value="signup" className="flex-1">Create Account</TabsTrigger>
              </TabsList>
              <TabsContent value="login" className="pt-4">
                <LoginForm onSuccess={() => setMode('register')} />
              </TabsContent>
              <TabsContent value="signup" className="pt-4">
                <SignUpForm onSuccess={() => setMode('auth_signup_sent')} />
              </TabsContent>
            </Tabs>
          </>
        )}

        {mode === 'auth_signup_sent' && (
          <>
            <DialogHeader>
              <DialogTitle>Check your inbox</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              We&apos;ve sent you a verification email. Click the link to verify your
              account, then return here and click &quot;Register Now&quot; to complete
              your registration.
            </p>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </>
        )}

        {mode === 'register' && (
          <>
            <DialogHeader>
              <DialogTitle>Register for {hackathonTitle}</DialogTitle>
            </DialogHeader>
            <RegistrationForm
              hackathonId={hackathonId}
              fields={registrationFields}
              onSuccess={() => setMode('success')}
              userName={userName}
              userEmail={userEmail}
            />
          </>
        )}

        {mode === 'success' && (
          <div className="space-y-4 py-2 text-center">
            <CheckCircle2 className="mx-auto size-12 text-green-500" />
            <h3 className="font-heading text-xl font-semibold">You&apos;re registered!</h3>
            <p className="text-sm text-muted-foreground">
              You can now find or create a team.
            </p>
            <div className="flex justify-center gap-3">
              <Button variant="outline" asChild onClick={() => onOpenChange(false)}>
                <Link href={`/hackathons/${hackathonSlug}/teams`}>Find a Team</Link>
              </Button>
              <Button asChild onClick={() => onOpenChange(false)}>
                <Link href={`/hackathons/${hackathonSlug}/teams/new`}>Create a Team</Link>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
