'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Upload, X, ImageIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn, slugify } from '@/lib/utils';
import { STORAGE_CONSTANTS } from '@/lib/storage/constants';
import { ImageCropModal } from './image-crop-modal';
import type { Hackathon } from '@/lib/services/hackathon-service';

// ---------------------------------------------------------------------------
// Validation schema (local — only fields for this step)
// ---------------------------------------------------------------------------

const basicInfoSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().max(5000, 'Description too long').optional().nullable(),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(100, 'Slug too long')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase with hyphens only'),
});

type BasicInfoFormValues = z.infer<typeof basicInfoSchema>;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StepBasicInfoProps {
  hackathonId: string;
  orgId: string;
  initialData: Partial<Hackathon>;
  onSave: (data: Partial<Hackathon>) => void;
  onNext: () => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StepBasicInfo({
  hackathonId,
  orgId,
  initialData,
  onSave,
  onNext,
  className,
}: StepBasicInfoProps) {
  const isSlugManuallyEdited = useRef(false);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [coverImageKey, setCoverImageKey] = useState<string | null>(
    initialData.coverImageKey ?? null,
  );
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [slugCollisionMessage, setSlugCollisionMessage] = useState<string | null>(null);

  // Crop modal state
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [showCropModal, setShowCropModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<BasicInfoFormValues>({
    resolver: zodResolver(basicInfoSchema),
    defaultValues: {
      title: initialData.title === 'Untitled Hackathon' ? '' : (initialData.title ?? ''),
      description: initialData.description ?? '',
      slug: initialData.slug ?? '',
    },
  });

  // Auto-generate slug from title (until user manually edits slug)
  const titleValue = watch('title');
  useEffect(() => {
    if (!isSlugManuallyEdited.current && titleValue) {
      setValue('slug', slugify(titleValue), { shouldValidate: titleValue.length >= 2 });
    }
  }, [titleValue, setValue]);

  const handleSlugChange = useCallback(() => {
    isSlugManuallyEdited.current = true;
    setSlugCollisionMessage(null);
  }, []);

  // ---------------------------------------------------------------------------
  // Image upload
  // ---------------------------------------------------------------------------

  const handleFileSelect = useCallback(
    (file: File) => {
      // Client-side validation
      if (
        !STORAGE_CONSTANTS.ALLOWED_IMAGE_TYPES.includes(
          file.type as (typeof STORAGE_CONSTANTS.ALLOWED_IMAGE_TYPES)[number],
        )
      ) {
        toast.error(`Invalid file type. Allowed: ${STORAGE_CONSTANTS.ALLOWED_IMAGE_TYPES.join(', ')}`);
        return;
      }
      if (file.size > STORAGE_CONSTANTS.MAX_IMAGE_SIZE) {
        toast.error(`File too large. Maximum size: ${STORAGE_CONSTANTS.MAX_IMAGE_SIZE / (1024 * 1024)}MB`);
        return;
      }
      setCropFile(file);
      setShowCropModal(true);
    },
    [],
  );

  const handleCropComplete = useCallback(
    async (blob: Blob) => {
      setShowCropModal(false);
      setCropFile(null);
      setIsUploading(true);

      try {
        const formData = new FormData();
        formData.append('file', blob, 'cover.webp');
        formData.append('hackathonId', hackathonId);
        formData.append('orgId', orgId);
        formData.append('imageType', 'cover');

        const res = await fetch('/api/upload/image', {
          method: 'POST',
          body: formData,
        });

        const body = await res.json();

        if (!res.ok) {
          toast.error(body.message ?? 'Failed to upload image.');
          return;
        }

        setCoverImageKey(body.key);
        setCoverImageUrl(body.url);
        toast.success('Cover image uploaded.');
      } catch {
        toast.error('Network error uploading image.');
      } finally {
        setIsUploading(false);
      }
    },
    [hackathonId, orgId],
  );

  const handleRemoveImage = useCallback(() => {
    setCoverImageKey(null);
    setCoverImageUrl(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileSelect(file);
      // Reset input so the same file can be re-selected
      e.target.value = '';
    },
    [handleFileSelect],
  );

  // ---------------------------------------------------------------------------
  // Save handler
  // ---------------------------------------------------------------------------

  const onSubmit = async (data: BasicInfoFormValues) => {
    setIsSaving(true);
    setSlugCollisionMessage(null);

    try {
      const res = await fetch(`/api/hackathons/${hackathonId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
          title: data.title,
          description: data.description || null,
          slug: data.slug,
          coverImageKey,
        }),
      });

      const body = await res.json();

      if (!res.ok) {
        toast.error(body.message ?? 'Failed to save basic info.');
        return;
      }

      // Handle slug collision
      if (body.slugModified) {
        setSlugCollisionMessage(
          `A hackathon with this slug already exists. We've modified yours to "${body.newSlug}". You can edit it manually.`,
        );
        setValue('slug', body.newSlug);
        isSlugManuallyEdited.current = true;
      }

      onSave(body.hackathon);
      onNext();
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const slugField = register('slug', { onChange: handleSlugChange });

  return (
    <div className={cn('space-y-6', className)}>
      <div>
        <h2 className="text-lg font-semibold">Basic Info</h2>
        <p className="text-sm text-muted-foreground">
          Give your hackathon a name and description. You can change these later.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Title */}
        <div className="space-y-2">
          <Label htmlFor="title" className={cn(errors.title && 'text-destructive')}>
            Title <span className="text-destructive">*</span>
          </Label>
          <Input
            id="title"
            placeholder="Innovation Challenge 2026"
            aria-invalid={!!errors.title}
            {...register('title')}
          />
          {errors.title && (
            <p role="alert" className="text-sm text-destructive">
              {errors.title.message}
            </p>
          )}
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <textarea
            id="description"
            rows={4}
            placeholder="Describe your hackathon — goals, themes, who should participate..."
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            {...register('description')}
          />
          {errors.description && (
            <p role="alert" className="text-sm text-destructive">
              {errors.description.message}
            </p>
          )}
        </div>

        {/* Slug */}
        <div className="space-y-2">
          <Label htmlFor="slug" className={cn(errors.slug && 'text-destructive')}>
            URL Slug <span className="text-destructive">*</span>
          </Label>
          <div className="flex items-center gap-0">
            <span className="inline-flex h-9 items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground">
              hackforge.com/hackathons/
            </span>
            <Input
              id="slug"
              placeholder="innovation-challenge-2026"
              className="rounded-l-none"
              aria-invalid={!!errors.slug}
              {...slugField}
            />
          </div>
          {errors.slug && (
            <p role="alert" className="text-sm text-destructive">
              {errors.slug.message}
            </p>
          )}
          {slugCollisionMessage && (
            <p className="text-sm text-blue-600">{slugCollisionMessage}</p>
          )}
        </div>

        {/* Cover image */}
        <div className="space-y-2">
          <Label>Cover Image</Label>
          <p className="text-xs text-muted-foreground">
            Optional. PNG, JPG, or WEBP up to 5MB. Will be cropped to 16:9.
          </p>

          {coverImageUrl || coverImageKey ? (
            <div className="relative overflow-hidden rounded-md border">
              {coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={coverImageUrl}
                  alt="Cover preview"
                  className="aspect-video w-full object-cover"
                />
              ) : (
                <div className="flex aspect-video w-full items-center justify-center bg-muted">
                  <ImageIcon className="size-10 text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Cover image saved</span>
                </div>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute right-2 top-2 bg-background/80 hover:bg-background"
                onClick={handleRemoveImage}
              >
                <X className="size-4" />
                <span className="sr-only">Remove image</span>
              </Button>
            </div>
          ) : (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed py-10 text-center transition-colors hover:border-primary hover:bg-accent/50',
                isUploading && 'pointer-events-none opacity-50',
              )}
            >
              <Upload className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {isUploading ? 'Uploading...' : 'Drop an image here or click to browse'}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept={STORAGE_CONSTANTS.ALLOWED_IMAGE_TYPES.join(',')}
                className="hidden"
                onChange={handleInputChange}
              />
            </div>
          )}
        </div>

        {/* Submit — handled by wizard navigation, but form needs a submit trigger */}
        <div className="flex justify-end">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save & Continue'}
          </Button>
        </div>
      </form>

      {/* Crop modal */}
      {cropFile && (
        <ImageCropModal
          imageFile={cropFile}
          aspectRatio={STORAGE_CONSTANTS.COVER_IMAGE_ASPECT_RATIO}
          isOpen={showCropModal}
          onClose={() => {
            setShowCropModal(false);
            setCropFile(null);
          }}
          onCropComplete={handleCropComplete}
        />
      )}
    </div>
  );
}
