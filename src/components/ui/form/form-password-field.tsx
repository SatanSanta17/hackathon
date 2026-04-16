'use client';

import { useState } from 'react';
import { type Control, type FieldPath, type FieldValues, useController } from 'react-hook-form';
import { Eye, EyeOff } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FormPasswordFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  placeholder?: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}

export function FormPasswordField<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  description,
  disabled,
  className,
}: FormPasswordFieldProps<T>) {
  const [showPassword, setShowPassword] = useState(false);

  const {
    field,
    fieldState: { error },
  } = useController({ control, name });

  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={name} className={cn(error && 'text-destructive')}>
        {label}
      </Label>
      <div className="relative">
        <Input
          id={name}
          type={showPassword ? 'text' : 'password'}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={
            error ? `${name}-error` : description ? `${name}-desc` : undefined
          }
          className="pr-9"
          {...field}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          onClick={() => setShowPassword((prev) => !prev)}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          tabIndex={-1}
        >
          {showPassword ? (
            <EyeOff className="size-3.5" />
          ) : (
            <Eye className="size-3.5" />
          )}
        </Button>
      </div>
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
