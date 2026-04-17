'use client';

import { useState, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { FormMessage } from '@/components/ui/form';
import type { RegistrationField } from '@/db/schema';

interface RegistrationFormProps {
  hackathonId: string;
  fields: RegistrationField[];
  onSuccess: () => void;
  userName: string | null;
  userEmail: string | null;
}

export function RegistrationForm({ hackathonId, fields, onSuccess, userName, userEmail }: RegistrationFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Build Zod schema dynamically from custom fields
  const schema = useMemo(() => {
    const customShape: Record<string, z.ZodTypeAny> = {};
    for (const field of fields) {
      customShape[field.id] = field.required
        ? z.string().min(1, `${field.label} is required`)
        : z.string().optional().default('');
    }
    return z.object({
      designation: z.string().optional().default(''),
      department: z.string().optional().default(''),
      isDiscoverable: z.boolean().default(true),
      ...customShape,
    });
  }, [fields]);

  type FormValues = {
    designation: string;
    department: string;
    isDiscoverable: boolean;
    [key: string]: string | boolean;
  };

  const {
    control,
    handleSubmit,
    register,
    formState: { errors },
  } = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
    defaultValues: { designation: '', department: '', isDiscoverable: true },
  });

  async function onSubmit(data: FormValues) {
    setIsSubmitting(true);
    setServerError(null);

    const { isDiscoverable, designation, department, ...customValues } = data as {
      isDiscoverable: boolean;
      designation: string;
      department: string;
      [key: string]: unknown;
    };

    const formData: Record<string, string> = {};
    if (designation) formData.designation = designation;
    if (department) formData.department = department;
    for (const field of fields) {
      const val = customValues[field.id];
      if (val) formData[field.id] = val as string;
    }

    try {
      const res = await fetch(`/api/hackathons/${hackathonId}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formData, isDiscoverable }),
      });

      if (!res.ok) {
        const body = await res.json();
        setServerError(body.message ?? 'Registration failed. Please try again.');
        return;
      }

      onSuccess();
    } catch {
      setServerError('Network error. Please check your connection.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {serverError && <FormMessage type="error" message={serverError} />}

      {/* Read-only identity fields */}
      <div className="space-y-1">
        <Label>Full Name</Label>
        <Input value={userName ?? ''} readOnly className="opacity-60" />
      </div>
      <div className="space-y-1">
        <Label>Email</Label>
        <Input value={userEmail ?? ''} readOnly className="opacity-60" />
      </div>

      {/* Standard optional fields */}
      <div className="space-y-1">
        <Label htmlFor="designation">Designation</Label>
        <Input
          id="designation"
          placeholder="e.g. Software Engineer"
          {...register('designation')}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="department">Department</Label>
        <Input
          id="department"
          placeholder="e.g. Engineering"
          {...register('department')}
        />
      </div>

      {/* Custom fields rendered in order */}
      {fields.map((field) => (
        <div key={field.id} className="space-y-1">
          <Label htmlFor={field.id}>
            {field.label}
            {field.required && <span className="ml-1 text-destructive">*</span>}
          </Label>

          {field.fieldType === 'text' && (
            <Input id={field.id} {...register(field.id)} />
          )}

          {field.fieldType === 'textarea' && (
            <Textarea
              id={field.id}
              rows={3}
              {...register(field.id)}
            />
          )}

          {field.fieldType === 'dropdown' && (
            <Controller
              control={control}
              name={field.id}
              render={({ field: f }) => (
                <Select
                  onValueChange={f.onChange}
                  defaultValue={f.value as string | undefined}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an option" />
                  </SelectTrigger>
                  <SelectContent>
                    {(field.options ?? []).map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          )}

          {errors[field.id] && (
            <FormMessage
              type="error"
              message={
                (errors[field.id] as { message?: string })
                  ?.message ?? 'Required'
              }
            />
          )}
        </div>
      ))}

      {/* Discoverability toggle */}
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <p className="text-sm font-medium">Show me on the participants browse page</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Other participants can find and team up with you.
          </p>
        </div>
        <Controller
          control={control}
          name="isDiscoverable"
          render={({ field: f }) => (
            <Switch
              checked={f.value as boolean}
              onCheckedChange={f.onChange}
            />
          )}
        />
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Registering...' : 'Register'}
      </Button>
    </form>
  );
}
