'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from '@hello-pangea/dnd';
import { GripVertical, Pencil, Trash2, Plus, ExternalLink } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { createTrackSchema, type CreateTrackInput } from '@/lib/validations/hackathon';
import type { Track } from '@/lib/services/hackathon-service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StepTracksProps {
  hackathonId: string;
  orgId: string;
  initialTracks: Track[];
  onTracksChange: (tracks: Track[]) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StepTracks({
  hackathonId,
  orgId,
  initialTracks,
  onTracksChange,
  className,
}: StepTracksProps) {
  const [tracks, setTracks] = useState<Track[]>(initialTracks);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ---------------------------------------------------------------------------
  // Add track form
  // ---------------------------------------------------------------------------

  const addForm = useForm<CreateTrackInput>({
    resolver: zodResolver(createTrackSchema),
    defaultValues: { name: '', description: '', resourcesUrl: '' },
  });

  const handleAddTrack = async (data: CreateTrackInput) => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/hackathons/${hackathonId}/tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, ...data }),
      });

      const body = await res.json();
      if (!res.ok) {
        toast.error(body.message ?? 'Failed to add track.');
        return;
      }

      const updated = [...tracks, body.track];
      setTracks(updated);
      onTracksChange(updated);
      addForm.reset();
      setShowAddForm(false);
      toast.success('Track added.');
    } catch (err: unknown) {
      console.error('Add track error:', err);
      toast.error(err instanceof Error ? err.message : 'Network error adding track.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Edit track
  // ---------------------------------------------------------------------------

  const editForm = useForm<CreateTrackInput>({
    resolver: zodResolver(createTrackSchema),
  });

  const startEditing = useCallback(
    (track: Track) => {
      setEditingTrackId(track.id);
      editForm.reset({
        name: track.name,
        description: track.description ?? '',
        resourcesUrl: track.resourcesUrl ?? '',
      });
    },
    [editForm],
  );

  const handleEditTrack = async (data: CreateTrackInput) => {
    if (!editingTrackId) return;
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/hackathons/${hackathonId}/tracks/${editingTrackId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, ...data }),
      });

      const body = await res.json();
      if (!res.ok) {
        toast.error(body.message ?? 'Failed to update track.');
        return;
      }

      const updated = tracks.map((t) => (t.id === editingTrackId ? body.track : t));
      setTracks(updated);
      onTracksChange(updated);
      setEditingTrackId(null);
      toast.success('Track updated.');
    } catch (err: unknown) {
      console.error('Edit track error:', err);
      toast.error(err instanceof Error ? err.message : 'Network error updating track.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Delete track
  // ---------------------------------------------------------------------------

  const handleDeleteTrack = useCallback(
    async (trackId: string) => {
      try {
        const res = await fetch(`/api/hackathons/${hackathonId}/tracks/${trackId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orgId }),
        });

        if (!res.ok) {
          const body = await res.json();
          toast.error(body.message ?? 'Failed to delete track.');
          return;
        }

        const updated = tracks.filter((t) => t.id !== trackId);
        setTracks(updated);
        onTracksChange(updated);
        toast.success('Track removed.');
      } catch (err: unknown) {
        console.error('Delete track error:', err);
        toast.error(err instanceof Error ? err.message : 'Network error removing track.');
      }
    },
    [hackathonId, orgId, tracks, onTracksChange],
  );

  // ---------------------------------------------------------------------------
  // Drag-and-drop reorder
  // ---------------------------------------------------------------------------

  const handleDragEnd = useCallback(
    async (result: DropResult) => {
      if (!result.destination) return;

      const items = Array.from(tracks);
      const [moved] = items.splice(result.source.index, 1);
      items.splice(result.destination.index, 0, moved);

      // Optimistic update
      setTracks(items);
      onTracksChange(items);

      // Persist new order — update each moved track
      try {
        const promises = items.map((track, index) =>
          fetch(`/api/hackathons/${hackathonId}/tracks/${track.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orgId, order: index }),
          }),
        );
        await Promise.all(promises);
      } catch (err: unknown) {
        console.error('Reorder tracks error:', err);
        toast.error(err instanceof Error ? err.message : 'Failed to save new order.');
      }
    },
    [tracks, hackathonId, orgId, onTracksChange],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className={cn('space-y-6', className)}>
      <div>
        <h2 className="text-lg font-semibold">Tracks & Themes</h2>
        <p className="text-sm text-muted-foreground">
          Define the tracks or themes for your hackathon. At least one track is required to publish.
        </p>
      </div>

      {/* Track list with drag-and-drop */}
      {tracks.length > 0 ? (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="tracks">
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="space-y-2"
              >
                {tracks.map((track, index) => (
                  <Draggable key={track.id} draggableId={track.id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={cn(
                          'flex items-start gap-3 rounded-lg border bg-card p-4',
                          snapshot.isDragging && 'shadow-lg ring-2 ring-primary',
                        )}
                      >
                        {/* Drag handle */}
                        <div
                          {...provided.dragHandleProps}
                          className="mt-0.5 cursor-grab text-muted-foreground"
                        >
                          <GripVertical className="size-5" />
                        </div>

                        {editingTrackId === track.id ? (
                          /* Inline edit form */
                          <form
                            onSubmit={editForm.handleSubmit(handleEditTrack)}
                            className="flex-1 space-y-3"
                          >
                            <Input
                              placeholder="Track name"
                              {...editForm.register('name')}
                            />
                            <textarea
                              placeholder="Description (optional)"
                              rows={2}
                              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              {...editForm.register('description')}
                            />
                            <Input
                              placeholder="Resources URL (optional)"
                              {...editForm.register('resourcesUrl')}
                            />
                            <div className="flex gap-2">
                              <Button type="submit" size="sm" disabled={isSubmitting}>
                                Save
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingTrackId(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          </form>
                        ) : (
                          /* Track display */
                          <div className="flex-1 min-w-0">
                            <p className="font-medium">{track.name}</p>
                            {track.description && (
                              <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                                {track.description}
                              </p>
                            )}
                            {track.resourcesUrl && (
                              <a
                                href={track.resourcesUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                              >
                                <ExternalLink className="size-3" />
                                Resources
                              </a>
                            )}
                          </div>
                        )}

                        {/* Actions */}
                        {editingTrackId !== track.id && (
                          <div className="flex shrink-0 gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => startEditing(track)}
                            >
                              <Pencil className="size-4" />
                              <span className="sr-only">Edit track</span>
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDeleteTrack(track.id)}
                            >
                              <Trash2 className="size-4" />
                              <span className="sr-only">Delete track</span>
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-10 text-center">
          <p className="text-sm text-muted-foreground">
            No tracks yet. Add your first track below.
          </p>
        </div>
      )}

      {/* Add track form */}
      {showAddForm ? (
        <form
          onSubmit={addForm.handleSubmit(handleAddTrack)}
          className="space-y-3 rounded-lg border bg-muted/30 p-4"
        >
          <div className="space-y-2">
            <Label htmlFor="add-track-name">
              Track Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="add-track-name"
              placeholder="e.g., AI & Machine Learning"
              {...addForm.register('name')}
            />
            {addForm.formState.errors.name && (
              <p className="text-sm text-destructive">
                {addForm.formState.errors.name.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-track-desc">Description</Label>
            <textarea
              id="add-track-desc"
              rows={2}
              placeholder="Describe this track (optional)"
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              {...addForm.register('description')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-track-url">Resources URL</Label>
            <Input
              id="add-track-url"
              placeholder="https://..."
              {...addForm.register('resourcesUrl')}
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? 'Adding...' : 'Add Track'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowAddForm(false);
                addForm.reset();
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowAddForm(true)}
        >
          <Plus className="mr-2 size-4" />
          Add Track
        </Button>
      )}
    </div>
  );
}
