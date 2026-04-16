import type { Metadata } from 'next';
import Link from 'next/link';

import { Card, CardContent, CardFooter } from '@/components/ui/card';

import { SignUpForm } from './_components/signup-form';

export const metadata: Metadata = {
  title: 'Sign Up — HackForge',
};

export default function SignUpPage() {
  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-heading font-semibold text-foreground">
            Create your account
          </h2>
          <p className="text-sm text-muted-foreground">
            Get started with HackForge
          </p>
        </div>

        <SignUpForm />
      </CardContent>

      <CardFooter className="justify-center">
        <p className="text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="text-primary underline-offset-4 hover:underline">
            Log in
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
