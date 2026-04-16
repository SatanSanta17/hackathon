import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth/auth';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  if (session.user.platformRole !== 'super_admin') {
    redirect('/dashboard');
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-14 items-center border-b border-border bg-background px-6">
        <h1 className="text-lg font-bold tracking-tight">Admin Panel</h1>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
