'use client';

import { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from '@hello-pangea/dnd';
import { GripVertical, Pencil, Trash2, Plus, Upload } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { createPrizeSchema, type CreatePrizeInput } from '@/lib/validations/hackathon';
import { STORAGE_CONSTANTS } from '@/lib/storage/constants';
import type { Prize } from '@/lib/services/hackathon-service';

// ---------------------------------------------------------------------------
// Preset prizes
// ---------------------------------------------------------------------------

const PRIZE_PRESETS = [
  '1st Place',
  '2nd Place',
  '3rd Place',
  'Best Innovation',
  "People's Choice",
] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StepPrizesProps {
  hackathonId: string;
  orgId: string;
  initialPrizes: Prize[];
  onPrizesChange: (prizes: Prize[]) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StepPrizes({
  hackathonId,
  orgId,
  initialPrizes,
  onPrizesChange,
  className,
}: StepPrizesProps) {
  const [prizes, setPrizes] = useState<Prize[]>(initialPrizes);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingPrizeId, setEditingPrizeId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingPrizeId, setUploadingPrizeId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---------------------------------------------------------------------------
  // Add prize form
  // ---------------------------------------------------------------------------

  const addForm = useForm<CreatePrizeInput>({
    resolver: zodResolver(createPrizeSchema),
    defaultValues: { name: '', description: '', rank: (prizes.length || 0) + 1 },
  });

  const handleAddPrize = async (data: CreatePrizeInput) => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/hackathons/${hackathonId}/prizes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, ...data }),
      });

      const body = await res.json();
      if (!res.ok) {
        toast.error(body.message ?? 'Failed to add prize.');
        return;
      }

      const updated = [...prizes, body.prize];
      setPrizes(updated);
      onPrizesChange(updated);
      addForm.reset({ name: '', description: '', rank: updated.length + 1 });
      setShowAddForm(false);
      toast.success('Prize added.');
    } catch {
      toast.error('Network error adding prize.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Preset quick-add
  // ---------------------------------------------------------------------------

  const handlePresetAdd = async (presetName: string) => {
    setIsSubmitting(true);
    try {
      const rank = prizes.length + 1;
      const res = await fetch(`/api/hackathons/${hackathonId}/prizes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, name: presetName, rank }),
      });

      const body = await res.json();
      if (!res.ok) {
        toast.error(body.message ?? 'Failed to add prize.');
        return;
      }

      const updated = [...prizes, body.prize];
      setPrizes(updated);
      onPrizesChange(updated);
      toast.success(`"${presetName}" added.`);
    } catch {
      toast.error('Network error adding prize.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Edit prize
  // ---------------------------------------------------------------------------

  const editForm = useForm<CreatePrizeInput>({
    resolver: zodResolver(createPrizeSchema),
  });

  const startEditing = useCallback(
    (prize: Prize) => {
      setEditingPrizeId(prize.id);
      editForm.reset({
        name: prize.name,
        description: prize.description ?? '',
        rank: prize.rank,
      });
    },
    [editForm],
  );

  const handleEditPrize = async (data: CreatePrizeInput) => {
    if (!editingPrizeId) return;
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/hackathons/${hackathonId}/prizes/${editingPrizeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, ...data }),
      });

      const body = await res.json();
      if (!res.ok) {
        toast.error(body.message ?? 'Failed to update prize.');
        return;
      }

      const updated = prizes.map((p) => (p.id === editingPrizeId ? body.prize : p));
      setPrizes(updated);
      onPrizesChange(updated);
      setEditingPrizeId(null);
      toast.success('Prize updated.');
    } catch {
      toast.error('Network error updating prize.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Delete prize
  // ---------------------------------------------------------------------------

  const handleDeletePrize = useCallback(
    async (prizeId: string) => {
      try {
        const res = await fetch(`/api/hackathons/${hackathonId}/prizes/${prizeId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orgId }),
        });

        if (!res.ok) {
          const body = await res.json();
          toast.error(body.message ?? 'Failed to delete prize.');
          return;
        }

        const updated = prizes.filter((p) => p.id !== prizeId);
        setPrizes(updated);
        onPrizesChange(updated);
        toast.success('Prize removed.');
      } catch {
        toast.error('Network error removing prize.');
      }
    },
    [hackathonId, orgId, prizes, onPrizesChange],
  );

  // ---------------------------------------------------------------------------
  // Drag-and-drop reorder
  // ---------------------------------------------------------------------------

  const handleDragEnd = useCallback(
    async (result: DropResult) => {
      if (!result.destination) return;

      const items = Array.from(prizes);
      const [moved] = items.splice(result.source.index, 1);
      items.splice(result.destination.index, 0, moved);

      // Optimistic update
      setPrizes(items);
      onPrizesChange(items);

      // Persist new ranks
      try {
        const promises = items.map((prize, index) =>
          fetch(`/api/hackathons/${hackathonId}/prizes/${prize.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orgId, rank: index + 1 }),
          }),
        );
        await Promise.all(promises);
      } catch {
        toast.error('Failed to save new order.');
      }
    },
    [prizes, hackathonId, orgId, onPrizesChange],
  );

  // ---------------------------------------------------------------------------
  // Prize image upload (no crop — direct upload)
  // ---------------------------------------------------------------------------

  const handleImageUpload = useCallback(
    async (prizeId: string, file: File) => {
      if (
        !STORAGE_CONSTANTS.ALLOWED_IMAGE_TYPES.includes(
          file.type as (typeof STORAGE_CONSTANTS.ALLOWED_IMAGE_TYPES)[number],
        )
      ) {
        toast.error('Invalid file type. Use PNG, JPG, or WEBP.');
        return;
      }
      if (file.size > STORAGE_CONSTANTS.MAX_IMAGE_SIZE) {
        toast.error('File too large. Maximum 5MB.');
        return;
      }

      setUploadingPrizeId(prizeId);
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('hackathonId', hackathonId);
        formData.append('orgId', orgId);
        formData.append('imageType', 'prize');
        formData.append('prizeId', prizeId);

        const res = await fetch('/api/upload/image', {
          method: 'POST',
          body: formData,
        });

        const body = await res.json();
        if (!res.ok) {
          toast.error(body.message ?? 'Failed to upload image.');
          return;
        }

        // Save imageKey to prize
        const patchRes = await fetch(`/api/hackathons/${hackathonId}/prizes/${prizeId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orgId, imageKey: body.key }),
        });

        const patchBody = await patchRes.json();
        if (patchRes.ok) {
          const updated = prizes.map((p) => (p.id === prizeId ? patchBody.prize : p));
          setPrizes(updated);
          onPrizesChange(updated);
          toast.success('Prize image uploaded.');
        }
      } catch {
        toast.error('Network error uploading image.');
      } finally {
        setUploadingPrizeId(null);
      }
    },
    [hackathonId, orgId, prizes, onPrizesChange],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className={cn('space-y-6', className)}>
      <div>
        <h2 className="text-lg font-semibold">Prizes</h2>
        <p className="text-sm text-muted-foreground">
          Add prizes for your hackathon. Prizes are optional — you can skip this step.
        </p>
      </div>

      {/* Preset quick-add buttons */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Quick add:</p>
        <div className="flex flex-wrap gap-2">
          {PRIZE_PRESETS.map((preset) => (
            <Button
              key={preset}
              type="button"
              variant="outline"
              size="sm"
              disabled={isSubmitting}
              onClick={() => handlePresetAdd(preset)}
            >
              <Plus className="mr-1 size-3" />
              {preset}
            </Button>
          ))}
        </div>
      </div>

      {/* Prize list with drag-and-drop */}
      {prizes.length > 0 ? (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="prizes">
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="space-y-2"
              >
                {prizes.map((prize, index) => (
                  <Draggable key={prize.id} draggableId={prize.id} index={index}>
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

                        {editingPrizeId === prize.id ? (
                          /* Inline edit form */
                          <form
                            onSubmit={editForm.handleSubmit(handleEditPrize)}
                            className="flex-1 space-y-3"
                          >
                            <Input
                              placeholder="Prize name"
                              {...editForm.register('name')}
                            />
                            <textarea
                              placeholder="Description (optional)"
                              rows={2}
                              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              {...editForm.register('description')}
                            />
                            <Input
                              type="number"
                              placeholder="Rank"
                              min={1}
                              {...editForm.register('rank', { valueAsNumber: true })}
                            />
                            <div className="flex gap-2">
                              <Button type="submit" size="sm" disabled={isSubmitting}>
                                Save
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingPrizeId(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          </form>
                        ) : (
                          /* Prize display */
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                                {prize.rank}
                              </span>
                              <p className="font-medium">{prize.name}</p>
                            </div>
                            {prize.description && (
                              <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                                {prize.description}
                              </p>
                            )}
                            {/* Image upload button */}
                            <button
                              type="button"
                              onClick={() => {
                                fileInputRef.current?.setAttribute('data-prize-id', prize.id);
                                fileInputRef.current?.click();
                              }}
                              disabled={uploadingPrizeId === prize.id}
                              className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              <Upload className="size-3" />
                              {uploadingPrizeId === prize.id
                                ? 'Uploading...'
                                : prize.imageKey
                                  ? 'Replace image'
                                  : 'Add image'}
                            </button>
                          </div>
                        )}

                        {/* Actions */}
                        {editingPrizeId !== prize.id && (
                          <div className="flex shrink-0 gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => startEditing(prize)}
                            >
                              <Pencil className="size-4" />
                              <span className="sr-only">Edit prize</span>
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDeletePrize(prize.id)}
                            >
                              <Trash2 className="size-4" />
                              <span className="sr-only">Delete prize</span>
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
            No prizes yet. Use the quick-add buttons above or add a custom prize below.
          </p>
        </div>
      )}

      {/* Hidden file input for prize image uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept={STORAGE_CONSTANTS.ALLOWED_IMAGE_TYPES.join(',')}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          const prizeId = fileInputRef.current?.getAttribute('data-prize-id');
          if (file && prizeId) handleImageUpload(prizeId, file);
          e.target.value = '';
        }}
      />

      {/* Add prize form */}
      {showAddForm ? (
        <form
          onSubmit={addForm.handleSubmit(handleAddPrize)}
          className="space-y-3 rounded-lg border bg-muted/30 p-4"
        >
          <div className="space-y-2">
            <Label htmlFor="add-prize-name">
              Prize Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="add-prize-name"
              placeholder="e.g., Grand Prize"
              {...addForm.register('name')}
            />
            {addForm.formState.errors.name && (
              <p className="text-sm text-destructive">
                {addForm.formState.errors.name.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-prize-desc">Description</Label>
            <textarea
              id="add-prize-desc"
              rows={2}
              placeholder="Describe this prize (optional)"
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              {...addForm.register('description')}
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? 'Adding...' : 'Add Prize'}
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
          Add Custom Prize
        </Button>
      )}
    </div>
  );
}
