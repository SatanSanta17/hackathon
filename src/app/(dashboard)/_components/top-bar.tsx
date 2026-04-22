'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { ChevronsUpDown, LogOut, Menu, Settings } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useSidebar } from '@/components/ui/sidebar';

interface OrgInfo {
  org: {
    id: string;
    name: string;
    slug: string;
  };
  role: string;
}

interface TopBarProps {
  currentOrg?: { id: string; name: string; slug: string };
  userOrgs?: OrgInfo[];
}

export function TopBar({ currentOrg, userOrgs = [] }: TopBarProps) {
  const { data: session } = useSession();
  const { toggleSidebar, isMobile } = useSidebar();

  const initials = session?.user?.name
    ? session.user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '??';

  const otherOrgs = userOrgs.filter(
    (o) => o.org.slug !== currentOrg?.slug,
  );
  const showOrgSwitcher = otherOrgs.length > 0;

  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-background px-4">
      {/* Mobile sidebar trigger */}
      {isMobile && (
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="shrink-0 md:hidden"
          aria-label="Toggle sidebar"
        >
          <Menu className="size-5" />
        </Button>
      )}

      {/* Org name / switcher */}
      <div className="flex items-center gap-2">
        {currentOrg && showOrgSwitcher ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 font-semibold">
                {currentOrg.name}
                <ChevronsUpDown className="size-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Switch organization</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {otherOrgs.map((o) => (
                <DropdownMenuItem key={o.org.id} asChild>
                  <Link href={`/dashboard/${o.org.slug}`}>
                    {o.org.name}
                  </Link>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/dashboard/create-org">Create new organization</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : currentOrg ? (
          <span className="font-semibold text-foreground">
            {currentOrg.name}
          </span>
        ) : null}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* User menu */}
      {session?.user && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2">
              <Avatar className="size-7">
                <AvatarFallback className="text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium md:inline-block">
                {session.user.name}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{session.user.name}</p>
                <p className="text-xs text-muted-foreground">
                  {session.user.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard/account">
                <Settings className="mr-2 size-4" />
                Account Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 size-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </header>
  );
}
