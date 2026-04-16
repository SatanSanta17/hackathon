import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'HackForge — Auth',
};

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm space-y-8">
        {/* Branding */}
        <div className="text-center">
          <h1 className="text-2xl font-heading font-bold text-foreground">
            HackForge
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enterprise Hackathon Platform
          </p>
        </div>

        {/* Page content */}
        {children}
      </div>
    </div>
  );
}
