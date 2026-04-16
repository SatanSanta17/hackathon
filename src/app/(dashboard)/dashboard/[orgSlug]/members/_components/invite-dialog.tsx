'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form/form-field';
import { inviteMemberSchema, type InviteMemberInput } from '@/lib/validations/org';
import { RoleSelect } from './role-select';
import { Label } from '@/components/ui/label';

interface InviteDialogProps {
  orgId: string;
  onInviteSent: () => void;
}

export function InviteDialog({ orgId, onInviteSent }: InviteDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { control, handleSubmit, reset, setValue, watch } =
    useForm<InviteMemberInput>({
      resolver: zodResolver(inviteMemberSchema),
      defaultValues: { email: '', role: 'member' },
    });

  const roleValue = watch('role');

  async function onSubmit(data: InviteMemberInput) {
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/orgs/${orgId}/members/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const body = await res.json();

      if (res.ok) {
        toast.success('Invitation sent successfully.');
        reset();
        setOpen(false);
        onInviteSent();
      } else {
        toast.error(body.message ?? 'Failed to send invitation.');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 size-4" />
          Invite Member
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Invite a member</DialogTitle>
            <DialogDescription>
              Send an invitation email to add someone to this organization.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <FormField
              control={control}
              name="email"
              label="Email Address"
              type="email"
              placeholder="colleague@example.com"
            />

            <div className="space-y-2">
              <Label>Role</Label>
              <RoleSelect
                value={roleValue}
                onValueChange={(v) =>
                  setValue('role', v as 'org_admin' | 'member', {
                    shouldValidate: true,
                  })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Sending...' : 'Send Invitation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
