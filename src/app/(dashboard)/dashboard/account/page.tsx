import { redirect } from 'next/navigation';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { auth } from '@/lib/auth/auth';
import { getStorageProvider } from '@/lib/storage';
import { getUserById } from '@/lib/services/auth-service';
import { getUserOrgs } from '@/lib/services/org-service';

import { ChangePasswordForm } from './_components/change-password-form';
import { OrgMembershipsList } from './_components/org-memberships-list';
import { PersonalInfoForm } from './_components/personal-info-form';

export const metadata = {
  title: 'Account Settings — HackForge',
};

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const [user, memberships] = await Promise.all([
    getUserById(session.user.id),
    getUserOrgs(session.user.id),
  ]);

  if (!user) {
    redirect('/login');
  }

  const storage = getStorageProvider();
  const avatarUrl = user.avatarUrl
    ? await storage.getSignedUrl(user.avatarUrl)
    : null;

  return (
    <div className="w-[70%] mx-auto space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Account Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your profile and security settings.
        </p>
      </div>

      <Separator />

      {/* Personal Info */}
      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>Update your name and profile photo.</CardDescription>
        </CardHeader>
        <CardContent>
          <PersonalInfoForm
            initialName={user.name}
            avatarUrl={avatarUrl}
          />
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>
            Keep your account secure with a strong password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>

      {/* Org Memberships */}
      <Card>
        <CardHeader>
          <CardTitle>Organization Memberships</CardTitle>
          <CardDescription>
            Organizations you belong to and your role in each.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OrgMembershipsList memberships={memberships} />
        </CardContent>
      </Card>
    </div>
  );
}
