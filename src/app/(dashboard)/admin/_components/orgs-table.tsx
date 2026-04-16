import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  memberCount: number;
  createdAt: string;
}

interface OrgsTableProps {
  organizations: OrgRow[];
}

export function OrgsTable({ organizations }: OrgsTableProps) {
  if (organizations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-12 text-center">
        <p className="text-sm text-muted-foreground">No organizations yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead className="text-right">Members</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {organizations.map((org) => (
            <TableRow key={org.id}>
              <TableCell className="font-medium">{org.name}</TableCell>
              <TableCell className="text-muted-foreground">{org.slug}</TableCell>
              <TableCell className="text-right">{org.memberCount}</TableCell>
              <TableCell className="text-muted-foreground">
                {new Date(org.createdAt).toLocaleDateString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
