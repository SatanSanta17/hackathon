'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { MoreHorizontal } from 'lucide-react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ORG_ROLE } from '@/lib/constants/enums';
import { InviteDialog } from './invite-dialog';
import { RoleSelect } from './role-select';

interface MemberData {
  membership: {
    id: string;
    userId: string;
    orgId: string;
    role: string;
    joinedAt: string | null;
    createdAt: string;
  };
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
}

interface MemberTableProps {
  orgId: string;
  initialMembers: MemberData[];
  currentUserRole: string;
}

export function MemberTable({
  orgId,
  initialMembers,
  currentUserRole,
}: MemberTableProps) {
  const { data: session } = useSession();
  const [members, setMembers] = useState<MemberData[]>(initialMembers);
  const isAdmin = currentUserRole === ORG_ROLE.ADMIN;

  // Role change dialog state
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [roleTarget, setRoleTarget] = useState<MemberData | null>(null);
  const [newRole, setNewRole] = useState('member');
  const [isChangingRole, setIsChangingRole] = useState(false);

  // Remove dialog state
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<MemberData | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const adminCount = members.filter((m) => m.membership.role === ORG_ROLE.ADMIN).length;

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch(`/api/orgs/${orgId}/members`);
      if (res.ok) {
        const body = await res.json();
        setMembers(body.members);
      }
    } catch {
      // Silently fail — user sees stale data
    }
  }, [orgId]);

  // Sync initialMembers if they change (e.g., on navigation)
  useEffect(() => {
    setMembers(initialMembers);
  }, [initialMembers]);

  function openRoleDialog(member: MemberData) {
    setRoleTarget(member);
    setNewRole(member.membership.role);
    setRoleDialogOpen(true);
  }

  async function handleChangeRole() {
    if (!roleTarget) return;
    setIsChangingRole(true);

    try {
      const res = await fetch(
        `/api/orgs/${orgId}/members/${roleTarget.membership.id}/role`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: newRole }),
        },
      );

      const body = await res.json();

      if (res.ok) {
        toast.success('Role updated successfully.');
        setRoleDialogOpen(false);
        fetchMembers();
      } else {
        toast.error(body.message ?? 'Failed to update role.');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setIsChangingRole(false);
    }
  }

  function openRemoveDialog(member: MemberData) {
    setRemoveTarget(member);
    setRemoveDialogOpen(true);
  }

  async function handleRemove() {
    if (!removeTarget) return;
    setIsRemoving(true);

    try {
      const res = await fetch(
        `/api/orgs/${orgId}/members/${removeTarget.membership.id}`,
        { method: 'DELETE' },
      );

      const body = await res.json();

      if (res.ok) {
        toast.success('Member removed from organization.');
        setRemoveDialogOpen(false);
        fetchMembers();
      } else {
        toast.error(body.message ?? 'Failed to remove member.');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setIsRemoving(false);
    }
  }

  function getInitials(name: string) {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  function isLastAdmin(member: MemberData) {
    return member.membership.role === ORG_ROLE.ADMIN && adminCount <= 1;
  }

  function isSelf(member: MemberData) {
    return member.user.id === session?.user?.id;
  }

  return (
    <div className="space-y-4">
      {/* Header with invite button */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Members ({members.length})
        </h2>
        {isAdmin && (
          <InviteDialog orgId={orgId} onInviteSent={fetchMembers} />
        )}
      </div>

      {/* Members table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12" />
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined</TableHead>
              {isAdmin && <TableHead className="w-12" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.membership.id}>
                <TableCell>
                  <Avatar className="size-8">
                    <AvatarFallback className="text-xs">
                      {getInitials(member.user.name)}
                    </AvatarFallback>
                  </Avatar>
                </TableCell>
                <TableCell className="font-medium">
                  {member.user.name}
                  {isSelf(member) && (
                    <span className="ml-1 text-xs text-muted-foreground">(you)</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {member.user.email}
                </TableCell>
                <TableCell>
                  <Badge variant={member.membership.role === ORG_ROLE.ADMIN ? 'default' : 'secondary'}>
                    {member.membership.role === ORG_ROLE.ADMIN ? 'Admin' : 'Member'}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {member.membership.joinedAt
                    ? new Date(member.membership.joinedAt).toLocaleDateString()
                    : '—'}
                </TableCell>
                {isAdmin && (
                  <TableCell>
                    {!isSelf(member) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8">
                            <MoreHorizontal className="size-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => openRoleDialog(member)}
                            disabled={isLastAdmin(member)}
                          >
                            Change role
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => openRemoveDialog(member)}
                            disabled={isLastAdmin(member)}
                            className="text-destructive focus:text-destructive"
                          >
                            Remove from org
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
            {members.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={isAdmin ? 6 : 5}
                  className="py-8 text-center text-muted-foreground"
                >
                  No members yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Change role dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change role</DialogTitle>
            <DialogDescription>
              Update the role for {roleTarget?.user.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <RoleSelect
              value={newRole}
              onValueChange={setNewRole}
              disabled={isChangingRole}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRoleDialogOpen(false)}
              disabled={isChangingRole}
            >
              Cancel
            </Button>
            <Button
              onClick={handleChangeRole}
              disabled={isChangingRole || newRole === roleTarget?.membership.role}
            >
              {isChangingRole ? 'Updating...' : 'Update Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove member dialog */}
      <Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove member</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {removeTarget?.user.name} from
              this organization? They will lose access immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRemoveDialogOpen(false)}
              disabled={isRemoving}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemove}
              disabled={isRemoving}
            >
              {isRemoving ? 'Removing...' : 'Remove Member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
