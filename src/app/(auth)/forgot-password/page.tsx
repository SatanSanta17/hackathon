import type { Metadata } from 'next';
import Link from 'next/link';

import { Card, CardContent, CardFooter } from '@/components/ui/card';

import { ForgotPasswordForm } from './_components/forgot-password-form';

export const metadata: Metadata = {
  title: 'Forgot Password — HackForge',
};

export default function ForgotPasswordPage() {
  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-heading font-semibold text-foreground">
            Reset your password
          </h2>
          <p className="text-sm text-muted-foreground">
            Enter your email and we&apos;ll send you a reset link.
          </p>
        </div>

        <ForgotPasswordForm />
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
