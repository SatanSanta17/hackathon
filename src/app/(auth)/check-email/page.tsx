import type { Metadata } from 'next';
import Link from 'next/link';
import { Mail } from 'lucide-react';

import { Card, CardContent, CardFooter } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Check Your Email — HackForge',
};

export default function CheckEmailPage() {
  return (
    <Card>
      <CardContent className="space-y-4 text-center">
        <Mail className="mx-auto size-10 text-muted-foreground" />

        <div className="space-y-1">
          <h2 className="text-lg font-heading font-semibold text-foreground">
            Check your email
          </h2>
          <p className="text-sm text-muted-foreground">
            We&apos;ve sent you a verification link. Click the link in your
            email to activate your account.
          </p>
        </div>

        <p className="text-xs text-muted-foreground">
          Didn&apos;t receive it? Check your spam folder or log in to resend the
          verification email.
        </p>
      </CardContent>

      <CardFooter className="justify-center">
        <Link
          href="/login"
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Back to login
        </Link>
      </CardFooter>
    </Card>
  );
}
