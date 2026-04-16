import type { Metadata } from 'next';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OrgsTable } from './_components/orgs-table';
import { UsersTable } from './_components/users-table';
import { listOrganizations, listUsers } from '@/lib/services/admin-service';

export const metadata: Metadata = {
  title: 'Admin Panel — HackForge',
};

export default async function AdminPage() {
  const [organizations, users] = await Promise.all([
    listOrganizations(),
    listUsers(),
  ]);

  // Serialize dates for client rendering
  const serializedOrgs = organizations.map((o) => ({
    ...o,
    createdAt: o.createdAt.toISOString(),
  }));

  const serializedUsers = users.map((u) => ({
    ...u,
    createdAt: u.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Platform overview — {organizations.length} organization(s), {users.length} user(s)
      </p>

      <Tabs defaultValue="organizations">
        <TabsList>
          <TabsTrigger value="organizations">
            Organizations ({organizations.length})
          </TabsTrigger>
          <TabsTrigger value="users">
            Users ({users.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="organizations" className="mt-4">
          <OrgsTable organizations={serializedOrgs} />
        </TabsContent>

        <TabsContent value="users" className="mt-4">
          <UsersTable users={serializedUsers} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
