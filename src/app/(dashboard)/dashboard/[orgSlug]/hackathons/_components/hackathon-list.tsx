'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Trophy,
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  ExternalLink,
  Archive,
  Trash2,
  CalendarIcon,
  Send,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import type { Hackathon } from '@/lib/services/hackathon-service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HackathonListProps {
  hackathons: Hackathon[];
  orgSlug: string;
  orgId: string;
  isAdmin: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'active', label: 'Active' },
  { value: 'judging', label: 'Judging' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
] as const;

const STATUS_BADGE_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  draft: 'secondary',
  published: 'default',
  active: 'default',
  judging: 'default',
  completed: 'outline',
  archived: 'outline',
};

const STATUS_BADGE_CLASS: Record<string, string> = {
  active: 'bg-green-600 text-white',
  judging: 'bg-amber-600 text-white',
  published: 'bg-blue-600 text-white',
};

const TEMPLATE_LABELS: Record<string, string> = {
  idea_sprint: 'Idea Sprint',
  build_and_ship: 'Build & Ship',
  innovation_pipeline: 'Innovation Pipeline',
  open_challenge: 'Open Challenge',
};

/**
 * Manual transitions only — middle states are date-driven via check-on-access.
 */
const MANUAL_TRANSITIONS: Record<string, { label: string; target: string; icon: typeof Send } | undefined> = {
  draft: { label: 'Publish', target: 'published', icon: Send },
  completed: { label: 'Archive', target: 'archived', icon: Archive },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function HackathonList({
  hackathons,
  orgSlug,
  orgId,
  isAdmin,
  className,
}: HackathonListProps) {
  const router = useRouter();

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState<Hackathon | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Transition loading state
  const [transitioningId, setTransitioningId] = useState<string | null>(null);

  // Filtered hackathons (client-side)
  const filtered = useMemo(() => {
    let result = hackathons;

    // Status filter (default: 'all' excludes archived)
    if (statusFilter === 'all') {
      result = result.filter((h) => h.status !== 'archived');
    } else {
      result = result.filter((h) => h.status === statusFilter);
    }

    // Search filter (by title, case-insensitive)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((h) => h.title.toLowerCase().includes(q));
    }

    // Date filter
    if (dateFrom) {
      result = result.filter((h) => new Date(h.createdAt) >= dateFrom);
    }
    if (dateTo) {
      const endOfDay = new Date(dateTo);
      endOfDay.setHours(23, 59, 59, 999);
      result = result.filter((h) => new Date(h.createdAt) <= endOfDay);
    }

    return result;
  }, [hackathons, statusFilter, searchQuery, dateFrom, dateTo]);

  // ---------------------------------------------------------------------------
  // API Handlers
  // ---------------------------------------------------------------------------

  async function handleTransition(hackathonId: string, targetStatus: string) {
    setTransitioningId(hackathonId);
    try {
      // Use the publish endpoint for draft → published (has extra validation)
      const url =
        targetStatus === 'published'
          ? `/api/hackathons/${hackathonId}/publish`
          : `/api/hackathons/${hackathonId}/transition`;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, targetStatus }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.message ?? 'Failed to update status.');
        return;
      }

      toast.success('Status updated.');
      router.refresh();
    } catch {
      toast.error('Something went wrong.');
    } finally {
      setTransitioningId(null);
    }
  }

  async function handleDelete(hackathonId: string) {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/hackathons/${hackathonId}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.message ?? 'Failed to delete hackathon.');
        return;
      }

      toast.success('Draft deleted.');
      setDeleteTarget(null);
      router.refresh();
    } catch {
      toast.error('Something went wrong.');
    } finally {
      setIsDeleting(false);
    }
  }

  function clearDateFilters() {
    setDateFrom(undefined);
    setDateTo(undefined);
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Hackathons</h1>
        {isAdmin && (
          <Button asChild>
            <Link href={`/dashboard/${orgSlug}/hackathons/create`}>
              <Plus className="mr-2 size-4" />
              Create Hackathon
            </Link>
          </Button>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search hackathons..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Status pills */}
        <div className="flex flex-wrap gap-1.5">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                statusFilter === opt.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Date filters */}
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                <CalendarIcon className="size-3.5" />
                {dateFrom ? format(dateFrom, 'MMM d, yyyy') : 'From'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateFrom}
                onSelect={setDateFrom}
              />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                <CalendarIcon className="size-3.5" />
                {dateTo ? format(dateTo, 'MMM d, yyyy') : 'To'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateTo}
                onSelect={setDateTo}
              />
            </PopoverContent>
          </Popover>

          {(dateFrom || dateTo) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              onClick={clearDateFilters}
            >
              <X className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Hackathon cards grid */}
      {filtered.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((hackathon) => (
            <HackathonCard
              key={hackathon.id}
              hackathon={hackathon}
              orgSlug={orgSlug}
              isAdmin={isAdmin}
              isTransitioning={transitioningId === hackathon.id}
              onTransition={handleTransition}
              onDeleteRequest={setDeleteTarget}
            />
          ))}
        </div>
      ) : (
        /* Empty state */
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-16 text-center">
          <Trophy className="size-10 text-muted-foreground" />
          <h2 className="mt-4 text-lg font-semibold">
            {hackathons.length === 0
              ? 'No hackathons yet'
              : 'No hackathons match your filters'}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {hackathons.length === 0
              ? 'Create your first hackathon to get started.'
              : 'Try adjusting your search or filters.'}
          </p>
          {hackathons.length === 0 && isAdmin && (
            <Button asChild className="mt-4">
              <Link href={`/dashboard/${orgSlug}/hackathons/create`}>
                <Plus className="mr-2 size-4" />
                Create your first hackathon
              </Link>
            </Button>
          )}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete draft hackathon?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &ldquo;{deleteTarget?.title}&rdquo;.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={() => deleteTarget && handleDelete(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hackathon Card (sub-component)
// ---------------------------------------------------------------------------

interface HackathonCardProps {
  hackathon: Hackathon;
  orgSlug: string;
  isAdmin: boolean;
  isTransitioning: boolean;
  onTransition: (hackathonId: string, targetStatus: string) => void;
  onDeleteRequest: (hackathon: Hackathon) => void;
}

function HackathonCard({
  hackathon,
  orgSlug,
  isAdmin,
  isTransitioning,
  onTransition,
  onDeleteRequest,
}: HackathonCardProps) {
  const transition = MANUAL_TRANSITIONS[hackathon.status];

  return (
    <Card className="group relative overflow-hidden">
      {/* Cover image or gradient placeholder */}
      <div className="relative h-32 w-full overflow-hidden bg-gradient-to-br from-muted to-muted/50">
        {hackathon.coverImageKey && (
          <div className="absolute inset-0 bg-muted" />
        )}
        {!hackathon.coverImageKey && (
          <div
            className={cn(
              'absolute inset-0',
              hackathon.templateType === 'build_and_ship'
                ? 'bg-gradient-to-br from-blue-900/30 to-indigo-900/30'
                : hackathon.templateType === 'idea_sprint'
                  ? 'bg-gradient-to-br from-purple-900/30 to-pink-900/30'
                  : hackathon.templateType === 'innovation_pipeline'
                    ? 'bg-gradient-to-br from-emerald-900/30 to-teal-900/30'
                    : 'bg-gradient-to-br from-orange-900/30 to-red-900/30',
            )}
          />
        )}

        {/* Status badge overlay */}
        <div className="absolute right-2 top-2">
          <Badge
            variant={STATUS_BADGE_VARIANT[hackathon.status] ?? 'outline'}
            className={cn('text-[10px] uppercase', STATUS_BADGE_CLASS[hackathon.status])}
          >
            {hackathon.status}
          </Badge>
        </div>
      </div>

      <CardContent className="p-4">
        {/* Title */}
        <h3 className="line-clamp-1 text-sm font-semibold">
          {hackathon.status !== 'draft' ? (
            <Link
              href={`/hackathons/${hackathon.slug}`}
              target="_blank"
              className="hover:underline"
            >
              {hackathon.title}
            </Link>
          ) : (
            hackathon.title
          )}
        </h3>

        {/* Template + Created date */}
        <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
          <span>{TEMPLATE_LABELS[hackathon.templateType] ?? hackathon.templateType}</span>
          <span>·</span>
          <span>{format(new Date(hackathon.createdAt), 'MMM d, yyyy')}</span>
        </div>

        {/* Participant count placeholder */}
        <p className="mt-2 text-xs text-muted-foreground">0 participants</p>
      </CardContent>

      {/* Admin context menu */}
      {isAdmin && (
        <div className="absolute right-2 bottom-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="size-7 p-0"
              >
                <MoreHorizontal className="size-4" />
                <span className="sr-only">Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {/* Edit */}
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/${orgSlug}/hackathons/${hackathon.id}/edit`}>
                  <Pencil className="mr-2 size-4" />
                  Edit
                </Link>
              </DropdownMenuItem>

              {/* View Landing Page (not for drafts) */}
              {hackathon.status !== 'draft' && (
                <DropdownMenuItem asChild>
                  <Link
                    href={`/hackathons/${hackathon.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="mr-2 size-4" />
                    View Landing Page
                  </Link>
                </DropdownMenuItem>
              )}

              {/* Manual transition (Publish or Archive) */}
              {transition && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onTransition(hackathon.id, transition.target)}
                    disabled={isTransitioning}
                  >
                    <transition.icon className="mr-2 size-4" />
                    {isTransitioning ? 'Updating...' : transition.label}
                  </DropdownMenuItem>
                </>
              )}

              {/* Delete draft */}
              {hackathon.status === 'draft' && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDeleteRequest(hackathon)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 size-4" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </Card>
  );
}
