import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Card, CardContent, CardFooter } from '@/components/ui/card';

import { LoginForm } from './_components/login-form';

export const metadata: Metadata = {
  title: 'Log In — HackForge',
};

export default function LoginPage() {
  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-heading font-semibold text-foreground">
            Welcome back
          </h2>
          <p className="text-sm text-muted-foreground">
            Log in to your account
          </p>
        </div>

        <Suspense>
          <LoginForm />
        </Suspense>
      </CardContent>

      <CardFooter className="justify-center">
        <p className="text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-primary underline-offset-4 hover:underline">
            Sign up
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
