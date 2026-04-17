'use client';

import { useState } from 'react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { RegistrationFieldInput } from '@/lib/validations/registration';

interface StepParticipationProps {
  hackathonId: string;
  orgId: string;
  initialRequiresApproval: boolean;
  initialFields: RegistrationFieldInput[];
  onSave: (data: { requiresApproval: boolean; fields: RegistrationFieldInput[] }) => void;
  onNext: () => void;
  className?: string;
}

export function StepParticipation({
  hackathonId,
  orgId,
  initialRequiresApproval,
  initialFields,
  onSave,
  onNext,
  className,
}: StepParticipationProps) {
  const [requiresApproval, setRequiresApproval] = useState(initialRequiresApproval);
  const [fields, setFields] = useState<RegistrationFieldInput[]>(initialFields);
  const [isSaving, setIsSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<number, string>>({});
  // Track dropdown options as comma-separated strings in UI state
  const [dropdownOptions, setDropdownOptions] = useState<Record<number, string>>(() => {
    const initial: Record<number, string> = {};
    initialFields.forEach((f, i) => {
      if (f.fieldType === 'dropdown' && f.options) {
        initial[i] = f.options.join(', ');
      }
    });
    return initial;
  });

  function addField() {
    if (fields.length >= 10) return;
    setFields((prev) => [
      ...prev,
      { label: '', fieldType: 'text', options: null, required: false, order: prev.length },
    ]);
  }

  function removeField(index: number) {
    setFields((prev) => prev.filter((_, i) => i !== index).map((f, i) => ({ ...f, order: i })));
    setDropdownOptions((prev) => {
      const next: Record<number, string> = {};
      Object.entries(prev).forEach(([k, v]) => {
        const ki = parseInt(k, 10);
        if (ki < index) next[ki] = v;
        else if (ki > index) next[ki - 1] = v;
      });
      return next;
    });
    setFieldErrors((prev) => {
      const next: Record<number, string> = {};
      Object.entries(prev).forEach(([k, v]) => {
        const ki = parseInt(k, 10);
        if (ki < index) next[ki] = v;
        else if (ki > index) next[ki - 1] = v;
      });
      return next;
    });
  }

  function updateField(index: number, patch: Partial<RegistrationFieldInput>) {
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  function handleDragEnd(result: DropResult) {
    if (!result.destination) return;
    const from = result.source.index;
    const to = result.destination.index;
    if (from === to) return;

    setFields((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next.map((f, i) => ({ ...f, order: i }));
    });

    // Re-key dropdownOptions and errors to match new positions
    setDropdownOptions((prev) => {
      const arr = Array.from({ length: fields.length }, (_, i) => prev[i] ?? '');
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      const next: Record<number, string> = {};
      arr.forEach((v, i) => { if (v) next[i] = v; });
      return next;
    });
  }

  async function handleSave() {
    // Validate — no empty labels
    const errors: Record<number, string> = {};
    fields.forEach((f, i) => {
      if (!f.label.trim()) errors[i] = 'Label is required.';
    });
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    // Parse dropdown options from comma-separated strings
    const parsedFields: RegistrationFieldInput[] = fields.map((f, i) => ({
      ...f,
      options:
        f.fieldType === 'dropdown'
          ? (dropdownOptions[i] ?? '')
              .split(',')
              .map((o) => o.trim())
              .filter(Boolean)
          : null,
      order: i,
    }));

    setIsSaving(true);
    try {
      // Save requiresApproval to hackathon
      const hackRes = await fetch(`/api/hackathons/${hackathonId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, requiresApproval }),
      });
      if (!hackRes.ok) {
        const body = await hackRes.json();
        toast.error(body.message ?? 'Failed to save participation settings.');
        return;
      }

      // Upsert registration fields
      const fieldsRes = await fetch(`/api/hackathons/${hackathonId}/registration-fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, fields: parsedFields }),
      });
      if (!fieldsRes.ok) {
        const body = await fieldsRes.json();
        toast.error(body.message ?? 'Failed to save registration fields.');
        return;
      }

      onSave({ requiresApproval, fields: parsedFields });
      onNext();
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className={cn('space-y-6', className)}>
      <div>
        <h2 className="text-lg font-semibold">Participation Settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure team approval and custom registration fields.
        </p>
      </div>

      {/* Requires approval toggle */}
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="space-y-0.5">
          <Label className="text-base">Require team approval</Label>
          <p className="text-sm text-muted-foreground">
            New teams will be marked "pending review" until an admin approves them.
          </p>
        </div>
        <Switch checked={requiresApproval} onCheckedChange={setRequiresApproval} />
      </div>

      {/* Custom registration fields */}
      <div className="space-y-4">
        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
          <p className="font-medium">Already captured automatically</p>
          <p className="mt-0.5 text-xs opacity-80">
            Full Name, Email, Designation, and Department are collected by default — no need to add them here.
          </p>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Custom Registration Fields</p>
            <p className="text-xs text-muted-foreground">
              Up to 10 additional fields shown on the registration form.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addField}
            disabled={fields.length >= 10}
          >
            <Plus className="mr-1.5 size-3.5" />
            Add Field
          </Button>
        </div>

        {fields.length === 0 && (
          <p className="text-sm italic text-muted-foreground">
            No custom fields. Participants will only provide their name and email.
          </p>
        )}

        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="fields">
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="space-y-3"
              >
                {fields.map((field, index) => (
                  <Draggable key={index} draggableId={String(index)} index={index}>
                    {(drag) => (
                      <div
                        ref={drag.innerRef}
                        {...drag.draggableProps}
                        className="rounded-lg border bg-card p-3"
                      >
                        <div className="flex items-start gap-2">
                          {/* Drag handle */}
                          <div
                            {...drag.dragHandleProps}
                            className="mt-2 shrink-0 cursor-grab text-muted-foreground"
                          >
                            <GripVertical className="size-4" />
                          </div>

                          <div className="flex flex-1 flex-col gap-2">
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                              {/* Label */}
                              <div className="space-y-1">
                                <Label className="text-xs">Label</Label>
                                <Input
                                  placeholder="e.g. GitHub profile"
                                  value={field.label}
                                  onChange={(e) => updateField(index, { label: e.target.value })}
                                />
                                {fieldErrors[index] && (
                                  <p className="text-xs text-destructive">{fieldErrors[index]}</p>
                                )}
                              </div>

                              {/* Field type */}
                              <div className="space-y-1">
                                <Label className="text-xs">Type</Label>
                                <Select
                                  value={field.fieldType}
                                  onValueChange={(val) =>
                                    updateField(index, {
                                      fieldType: val as RegistrationFieldInput['fieldType'],
                                      options: null,
                                    })
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="text">Short Text</SelectItem>
                                    <SelectItem value="textarea">Long Answer</SelectItem>
                                    <SelectItem value="dropdown">Dropdown</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            {/* Dropdown options */}
                            {field.fieldType === 'dropdown' && (
                              <div className="space-y-1">
                                <Label className="text-xs">Options (comma-separated)</Label>
                                <Input
                                  placeholder="Option 1, Option 2, Option 3"
                                  value={dropdownOptions[index] ?? ''}
                                  onChange={(e) =>
                                    setDropdownOptions((prev) => ({
                                      ...prev,
                                      [index]: e.target.value,
                                    }))
                                  }
                                />
                              </div>
                            )}

                            {/* Required toggle */}
                            <div className="flex items-center gap-2">
                              <Switch
                                id={`required-${index}`}
                                checked={field.required}
                                onCheckedChange={(checked) =>
                                  updateField(index, { required: checked })
                                }
                              />
                              <Label htmlFor={`required-${index}`} className="text-xs cursor-pointer">
                                Required
                              </Label>
                            </div>
                          </div>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => removeField(index)}
                            className="mt-1 shrink-0 text-muted-foreground hover:text-destructive"
                            aria-label="Remove field"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save & Continue'}
        </Button>
      </div>
    </div>
  );
}
