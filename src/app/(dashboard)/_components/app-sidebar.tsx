'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Trophy, Users, Settings, CalendarCheck2 } from 'lucide-react';

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

interface AppSidebarProps {
  orgSlug: string;
}

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '' },
  { icon: CalendarCheck2, label: 'My Hackathons', path: '/my-hackathons' },
  { icon: Trophy, label: 'Hackathons', path: '/hackathons' },
  { icon: Users, label: 'Members', path: '/members' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

export function AppSidebar({ orgSlug }: AppSidebarProps) {
  const pathname = usePathname();
  const basePath = `/dashboard/${orgSlug}`;

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <Link
          href="/dashboard"
          className="text-lg font-bold tracking-tight text-sidebar-foreground"
        >
          HackForge
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const href = `${basePath}${item.path}`;
                const isActive =
                  item.path === ''
                    ? pathname === basePath
                    : pathname.startsWith(href);

                return (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link href={href}>
                        <item.icon className="size-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
