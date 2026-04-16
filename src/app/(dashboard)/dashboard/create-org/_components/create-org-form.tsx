'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormField } from '@/components/ui/form/form-field';
import { FormMessage } from '@/components/ui/form/form-message';
import { createOrgSchema, type CreateOrgInput } from '@/lib/validations/org';
import { slugify } from '@/lib/utils';
import { cn } from '@/lib/utils';

export function CreateOrgForm() {
  const router = useRouter();
  const [formMessage, setFormMessage] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);

  const { control, handleSubmit, watch, setValue, register, formState } =
    useForm<CreateOrgInput>({
      resolver: zodResolver(createOrgSchema),
      defaultValues: { name: '', slug: '' },
    });

  // Auto-generate slug from name (until user manually edits slug)
  const nameValue = watch('name');

  useEffect(() => {
    if (!slugTouched && nameValue) {
      setValue('slug', slugify(nameValue), { shouldValidate: nameValue.length >= 2 });
    }
  }, [nameValue, slugTouched, setValue]);

  const handleSlugChange = useCallback(() => {
    setSlugTouched(true);
  }, []);

  async function onSubmit(data: CreateOrgInput) {
    setIsSubmitting(true);
    setFormMessage(null);

    try {
      const res = await fetch('/api/orgs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const body = await res.json();

      if (res.ok) {
        router.push(`/dashboard/${body.org.slug}`);
      } else {
        setFormMessage({
          type: 'error',
          message: body.message ?? 'Failed to create organization.',
        });
      }
    } catch {
      setFormMessage({
        type: 'error',
        message: 'Network error. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const slugError = formState.errors.slug;
  const slugField = register('slug', {
    onChange: handleSlugChange,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {formMessage && (
        <FormMessage type={formMessage.type} message={formMessage.message} />
      )}

      <FormField
        control={control}
        name="name"
        label="Organization Name"
        placeholder="Acme Inc."
      />

      {/* Slug field — uses register() directly for onChange intercept */}
      <div className="space-y-2">
        <Label htmlFor="slug" className={cn(slugError && 'text-destructive')}>
          URL Slug
        </Label>
        <Input
          id="slug"
          placeholder="acme-inc"
          aria-invalid={!!slugError}
          aria-describedby={slugError ? 'slug-error' : 'slug-desc'}
          {...slugField}
        />
        {!slugError && (
          <p id="slug-desc" className="text-sm text-muted-foreground">
            Used in your dashboard URL: /dashboard/your-slug
          </p>
        )}
        {slugError && (
          <p id="slug-error" role="alert" className="text-sm text-destructive">
            {slugError.message}
          </p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Creating...' : 'Create Organization'}
      </Button>
    </form>
  );
}
