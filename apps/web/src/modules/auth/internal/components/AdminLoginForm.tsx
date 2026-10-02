import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { ChunkyInput } from '@/components/ui/chunky-input';
import { ChunkyButton } from '@/components/ui/chunky-button';
import { ChunkyCard } from '@/components/ui/chunky-card';
import { useAuthStore } from '../store';
import { loginSchema, type LoginSchema } from '../schema';

export interface AdminLoginFormProps {
  onSuccess?: () => void;
}

export function AdminLoginForm({ onSuccess }: AdminLoginFormProps) {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const authError = useAuthStore((state) => state.error);
  const isLoadingState = useAuthStore((state) => state.isLoading);
  const [showPassword, setShowPassword] = React.useState(false);
  const [attempts, setAttempts] = React.useState(0);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberThisDevice: false,
    },
  });

  const onSubmit = async (values: LoginSchema) => {
    setAttempts((n) => n + 1);
    const success = await login(values);
    if (success) {
      if (onSuccess) {
        onSuccess();
      } else {
        navigate({ to: '/admin' });
      }
    }
  };

  const isPending = isSubmitting || isLoadingState;

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
        onSubmit={handleSubmit(onSubmit)}
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

        <div>
          <label
            htmlFor="admin-password"
            className="mb-1.5 block font-sans text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]"
          >
            Password
          </label>
          <div className="relative">
            <ChunkyInput
              id="admin-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              aria-invalid={Boolean(errors.password)}
              disabled={isPending}
              className="pr-12"
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              disabled={isPending}
              className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-xl text-[var(--muted)] transition-colors hover:bg-[var(--surface-raised)] hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Eye className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1 font-sans text-xs font-bold text-[var(--red)]">
              {errors.password.message}
            </p>
          )}
        </div>

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
