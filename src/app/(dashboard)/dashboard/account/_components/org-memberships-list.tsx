import Link from 'next/link';
import { Building2, ExternalLink } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { ORG_ROLE } from '@/lib/constants/enums';

interface OrgMembership {
  org: { id: string; name: string; slug: string };
  role: string;
}

interface OrgMembershipsListProps {
  memberships: OrgMembership[];
}

export function OrgMembershipsList({ memberships }: OrgMembershipsListProps) {
  if (memberships.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        You are not a member of any organizations yet.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {memberships.map(({ org, role }) => (
        <li
          key={org.id}
          className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-md bg-primary/10">
              <Building2 className="size-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{org.name}</p>
              <Badge variant="secondary" className="mt-0.5 text-2xs">
                {role === ORG_ROLE.ADMIN ? 'Admin' : 'Member'}
              </Badge>
            </div>
          </div>
          <Link
            href={`/dashboard/${org.slug}`}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Dashboard
            <ExternalLink className="size-3" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
