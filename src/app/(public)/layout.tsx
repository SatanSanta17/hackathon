import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    template: '%s | HackForge',
    default: 'HackForge — Enterprise Hackathon Platform',
  },
};

export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="theme-competitive min-h-screen bg-background text-foreground">
      {children}
    </div>
  );
}
