import { Suspense } from 'react';
import type { Metadata } from 'next';

import { Card, CardContent } from '@/components/ui/card';

import { ResetPasswordForm } from './_components/reset-password-form';

export const metadata: Metadata = {
  title: 'Reset Password — HackForge',
};

export default function ResetPasswordPage() {
  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-heading font-semibold text-foreground">
            Choose a new password
          </h2>
          <p className="text-sm text-muted-foreground">
            Enter your new password below.
          </p>
        </div>

        <Suspense>
          <ResetPasswordForm />
        </Suspense>
      </CardContent>
    </Card>
  );
}
