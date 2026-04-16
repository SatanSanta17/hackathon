import Link from 'next/link';
import { SearchX } from 'lucide-react';

import { Button } from '@/components/ui/button';

export default function HackathonNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <SearchX className="h-16 w-16 text-muted-foreground" />
      <h1 className="mt-6 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
        Hackathon Not Found
      </h1>
      <p className="mt-3 text-lg text-muted-foreground">
        This hackathon doesn&apos;t exist or isn&apos;t available yet.
      </p>
      <Button asChild className="mt-8" size="lg">
        <Link href="/">Back to HackForge</Link>
      </Button>
    </div>
  );
}
