import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CreateOrgForm } from './_components/create-org-form';
import { auth } from '@/lib/auth/auth';

export const metadata: Metadata = {
  title: 'Create Organization — HackForge',
};

export default async function CreateOrgPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const isVerified = session.user.isEmailVerified;

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create Organization</CardTitle>
          <CardDescription>
            Set up a new organization to start running hackathons.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isVerified ? (
            <CreateOrgForm />
          ) : (
            <p className="text-sm text-muted-foreground">
              Please verify your email before creating an organization.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
