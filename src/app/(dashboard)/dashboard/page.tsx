import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Building2, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { auth } from '@/lib/auth/auth';
import { ORG_ROLE } from '@/lib/constants/enums';
import { getUserOrgs } from '@/lib/services/org-service';

export const metadata = {
  title: 'Dashboard — HackForge',
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const userOrgs = await getUserOrgs(session.user.id);

  // Single org → redirect directly
  if (userOrgs.length === 1) {
    redirect(`/dashboard/${userOrgs[0].org.slug}`);
  }

  // Multiple orgs → show picker
  if (userOrgs.length > 1) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">
              Select an organization
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Choose which organization you&apos;d like to work in.
            </p>
          </div>

          <div className="space-y-3">
            {userOrgs.map((item) => (
              <Link
                key={item.org.id}
                href={`/dashboard/${item.org.slug}`}
                className="block"
              >
                <Card className="transition-colors hover:bg-accent">
                  <CardHeader className="flex flex-row items-center gap-3 p-4">
                    <div className="flex size-10 items-center justify-center rounded-md bg-primary/10">
                      <Building2 className="size-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-base">
                        {item.org.name}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {item.role === ORG_ROLE.ADMIN ? 'Admin' : 'Member'}
                      </CardDescription>
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>

          <div className="text-center">
            <Button variant="outline" asChild>
              <Link href="/dashboard/create-org">
                <Plus className="mr-2 size-4" />
                Create new organization
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Zero orgs → prompt to create
  const isVerified = session.user.isEmailVerified;

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/10">
          <Building2 className="size-8 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome to HackForge
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Create your first organization to get started.
          </p>
        </div>
        {isVerified ? (
          <Button asChild>
            <Link href="/dashboard/create-org">
              <Plus className="mr-2 size-4" />
              Create Organization
            </Link>
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            Please verify your email before creating an organization.
          </p>
        )}
      </div>
    </div>
  );
}
