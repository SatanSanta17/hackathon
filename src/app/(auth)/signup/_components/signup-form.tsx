'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { Button } from '@/components/ui/button';
import { FormField, FormPasswordField, FormMessage } from '@/components/ui/form';
import { signUpSchema, type SignUpInput } from '@/lib/validations/auth';

interface SignUpFormProps {
  onSuccess?: () => void;
}

export function SignUpForm({ onSuccess }: SignUpFormProps = {}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
    },
  });

  async function onSubmit(data: SignUpInput) {
    setServerError(null);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (res.status === 201) {
        if (onSuccess) {
          onSuccess();
        } else {
          router.push('/check-email');
        }
        return;
      }

      const body = await res.json();

      if (res.status === 409) {
        setServerError('An account with this email already exists.');
      } else {
        setServerError(body.message ?? 'Something went wrong. Please try again.');
      }
    } catch {
      setServerError('Network error. Please check your connection.');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {serverError && <FormMessage type="error" message={serverError} />}

      <FormField
        control={control}
        name="name"
        label="Full Name"
        placeholder="Jane Doe"
        disabled={isSubmitting}
      />

      <FormField
        control={control}
        name="email"
        label="Email"
        type="email"
        placeholder="jane@example.com"
        disabled={isSubmitting}
      />

      <FormPasswordField
        control={control}
        name="password"
        label="Password"
        placeholder="Min. 8 characters"
        description="Must contain uppercase, lowercase, and a number."
        disabled={isSubmitting}
      />

      <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
        {isSubmitting ? 'Creating account...' : 'Create Account'}
      </Button>
    </form>
  );
}
