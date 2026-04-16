'use client';

import { type Control, type FieldPath, type FieldValues, useController } from 'react-hook-form';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface FormFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  type?: string;
  placeholder?: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}

export function FormField<T extends FieldValues>({
  control,
  name,
  label,
  type = 'text',
  placeholder,
  description,
  disabled,
  className,
}: FormFieldProps<T>) {
  const {
    field,
    fieldState: { error },
  } = useController({ control, name });

  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={name} className={cn(error && 'text-destructive')}>
        {label}
      </Label>
      <Input
        id={name}
        type={type}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={!!error}
        aria-describedby={
          error ? `${name}-error` : description ? `${name}-desc` : undefined
        }
        {...field}
      />
      {description && !error && (
        <p id={`${name}-desc`} className="text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {error && (
        <p
          id={`${name}-error`}
          role="alert"
          className="text-sm text-destructive"
        >
          {error.message}
        </p>
      )}
    </div>
  );
}
