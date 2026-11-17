import * as React from 'react';
import { ShieldCheck } from 'lucide-react';
import { ChunkyInput } from '@/components/ui/chunky-input';
import { ChunkyButton } from '@/components/ui/chunky-button';
import { ChunkyCard } from '@/components/ui/chunky-card';
import type { LoginSchema } from '../schema';
import { PasswordField } from './PasswordField';
import { useLoginFormState } from './useLoginFormState';

export interface AdminLoginFormProps {
  onSuccess?: () => void;
}

export function AdminLoginForm({ onSuccess }: AdminLoginFormProps) {
  const [attempts, setAttempts] = React.useState(0);
  const {
    register,
    handleSubmit,
    formState: { errors },
    authError,
    isPending,
    onSubmit,
  } = useLoginFormState({ onSuccess, defaultRedirect: '/admin' });

  const handleFormSubmit = async (values: LoginSchema) => {
    setAttempts((n) => n + 1);
    await onSubmit(values);
  };

  return (
    <ChunkyCard data-testid="admin-login-card" className="w-full p-6 sm:p-8">
      <div className="mb-6">
        <p className="inline-flex items-center gap-1.5 rounded-full border-2 border-[var(--purple-dark)] bg-[var(--purple)] px-3 py-1 font-sans text-[11px] font-extrabold uppercase tracking-[0.8px] text-white">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          Admin console
        </p>
        <h1 className="mt-3 font-display text-2xl font-extrabold text-[var(--ink)]">
          Gatekeeper sign in
        </h1>
        <p className="mt-1 font-sans text-sm font-semibold text-[var(--muted)]">
          This area is invite-only. Sign in with your admin credentials.
        </p>
      </div>

      {authError && (
        <div
          key={attempts}
          role="alert"
          data-testid="admin-login-error"
          className="animate-chunky-shake mb-4 rounded-2xl border-2 border-b-4 border-[var(--red-dark)] bg-[var(--red)]/10 p-3 font-sans text-sm font-bold text-[var(--red)]"
        >
          {authError}
        </div>
      )}

      <form
        onSubmit={handleSubmit(handleFormSubmit)}
        className="flex flex-col gap-4"
        noValidate
      >
        <div>
          <label
            htmlFor="admin-email"
            className="mb-1.5 block font-sans text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]"
          >
            Admin identity
          </label>
          <ChunkyInput
            id="admin-email"
            type="email"
            autoComplete="username"
            placeholder="admin@example.com"
            aria-invalid={Boolean(errors.email)}
            disabled={isPending}
            {...register('email')}
          />
          {errors.email && (
            <p className="mt-1 font-sans text-xs font-bold text-[var(--red)]">
              {errors.email.message}
            </p>
          )}
        </div>

        <PasswordField
          id="admin-password"
          label="Password"
          error={errors.password?.message}
          disabled={isPending}
          registration={register('password')}
        />

        <ChunkyButton
          type="submit"
          variant="primary"
          disabled={isPending}
          className="mt-1 w-full border-[var(--purple-dark)] bg-[var(--purple)]"
        >
          <ShieldCheck aria-hidden="true" />
          {isPending ? 'Verifying...' : 'Enter console'}
        </ChunkyButton>
      </form>

      <p className="mt-6 text-center font-sans text-sm font-semibold text-[var(--muted)]">
        Invite-only — contact the server owner for access.
      </p>
    </ChunkyCard>
  );
}
