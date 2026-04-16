import { SessionProvider } from '@/components/providers/session-provider';
import { VerificationBanner } from '@/components/verification-banner';
import { SidebarProvider } from '@/components/ui/sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <SidebarProvider>
        <VerificationBanner />
        <div className="flex flex-1 w-full">
          {children}
        </div>
      </SidebarProvider>
    </SessionProvider>
  );
}
