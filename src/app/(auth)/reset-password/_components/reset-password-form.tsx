'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { FormPasswordField, FormMessage } from '@/components/ui/form';

// Extend the reset schema to include confirmPassword (client-only)
const resetFormSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type ResetFormInput = z.infer<typeof resetFormSchema>;

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<ResetFormInput>({
    resolver: zodResolver(resetFormSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  if (!token) {
    return (
      <div className="space-y-3">
        <FormMessage type="error" message="Invalid reset link. No token provided." />
        <Link
          href="/forgot-password"
          className="block text-center text-sm text-primary underline-offset-4 hover:underline"
        >
          Request a new reset link
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="space-y-3">
        <FormMessage type="success" message="Your password has been reset successfully." />
        <Link
          href="/login"
          className="block text-center text-sm text-primary underline-offset-4 hover:underline"
        >
          Go to login
        </Link>
      </div>
    );
  }

  async function onSubmit(data: ResetFormInput) {
    setServerError(null);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: data.password }),
      });

      if (res.ok) {
        setSuccess(true);
        return;
      }

      const body = await res.json();

      if (res.status === 400) {
        setServerError('This reset link is invalid or has expired.');
      } else {
        setServerError(body.message ?? 'Something went wrong. Please try again.');
      }
    } catch {
      setServerError('Network error. Please check your connection.');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {serverError && (
        <div className="space-y-3">
          <FormMessage type="error" message={serverError} />
          <Link
            href="/forgot-password"
            className="block text-center text-sm text-primary underline-offset-4 hover:underline"
          >
            Request a new reset link
          </Link>
        </div>
      )}

      <FormPasswordField
        control={control}
        name="password"
        label="New Password"
        placeholder="Min. 8 characters"
        description="Must contain uppercase, lowercase, and a number."
        disabled={isSubmitting}
      />

      <FormPasswordField
        control={control}
        name="confirmPassword"
        label="Confirm Password"
        placeholder="Re-enter your password"
        disabled={isSubmitting}
      />

      <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
        {isSubmitting ? 'Resetting...' : 'Reset Password'}
      </Button>
    </form>
  );
}
