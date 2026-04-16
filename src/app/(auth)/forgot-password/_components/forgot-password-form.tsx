'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button } from '@/components/ui/button';
import { FormField, FormMessage } from '@/components/ui/form';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@/lib/validations/auth';

export function ForgotPasswordForm() {
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  async function onSubmit(data: ForgotPasswordInput) {
    setServerError(null);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        setSubmitted(true);
        return;
      }

      const body = await res.json();
      setServerError(body.message ?? 'Something went wrong. Please try again.');
    } catch {
      setServerError('Network error. Please check your connection.');
    }
  }

  if (submitted) {
    return (
      <FormMessage
        type="success"
        message="If an account exists with that email, a password reset link has been sent. Check your inbox."
      />
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {serverError && <FormMessage type="error" message={serverError} />}

      <FormField
        control={control}
        name="email"
        label="Email"
        type="email"
        placeholder="jane@example.com"
        disabled={isSubmitting}
      />

      <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
        {isSubmitting ? 'Sending...' : 'Send Reset Link'}
      </Button>
    </form>
  );
}
