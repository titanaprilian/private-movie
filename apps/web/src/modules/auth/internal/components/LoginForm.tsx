import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from '@tanstack/react-router';
import { LogIn } from 'lucide-react';
import { ChunkyInput } from '@/components/ui/chunky-input';
import { ChunkyButton } from '@/components/ui/chunky-button';
import { ChunkyCheckbox } from '@/components/ui/chunky-checkbox';
import { useAuthStore } from '../store';
import { loginSchema, type LoginSchema } from '../schema';

export interface LoginFormProps {
  onSuccess?: () => void;
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const authError = useAuthStore((state) => state.error);
  const isLoadingState = useAuthStore((state) => state.isLoading);
  const [localError, setLocalError] = React.useState<string | null>(null);

  const {
    register,
    control,
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
    setLocalError(null);
    const success = await login(values);
    if (success) {
      if (onSuccess) {
        onSuccess();
      } else {
        navigate({ to: '/admin' });
      }
    }
  };

  const displayError = localError || authError;
  const isPending = isSubmitting || isLoadingState;

  return (
    <div className="w-full max-w-sm">
      <div className="mb-6">
        <div className="text-xs mono text-primary mb-2">$ auth login</div>
        <h1 className="text-xl font-semibold">Access your workspace</h1>
        <p className="text-sm text-muted mt-1">
          Sign in with your organization credentials.
        </p>
      </div>

      <div className="bg-card border border-c rounded-md p-6">
        {displayError && (
          <div
            role="alert"
            className="mb-4 rounded-2xl border-2 border-b-4 border-[var(--red-dark)] bg-[var(--red)]/10 p-3 font-sans text-sm font-bold text-[var(--red)]"
          >
            {displayError}
          </div>
        )}

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
          noValidate
        >
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block font-sans text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]"
            >
              Email
            </label>
            <ChunkyInput
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
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
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="password"
                className="block font-sans text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]"
              >
                Password
              </label>
              <a
                href="#"
                className="font-sans text-xs font-extrabold text-[var(--green-dark)] hover:underline"
              >
                forgot?
              </a>
            </div>
            <ChunkyInput
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              aria-invalid={Boolean(errors.password)}
              disabled={isPending}
              {...register('password')}
            />
            {errors.password && (
              <p className="mt-1 font-sans text-xs font-bold text-[var(--red)]">
                {errors.password.message}
              </p>
            )}
          </div>

          <Controller
            control={control}
            name="rememberThisDevice"
            render={({ field }) => (
              <div className="flex items-center gap-2.5">
                <ChunkyCheckbox
                  id="rememberThisDevice"
                  aria-label="Remember this device"
                  checked={Boolean(field.value)}
                  onCheckedChange={field.onChange}
                  disabled={isPending}
                />
                <label
                  htmlFor="rememberThisDevice"
                  className="cursor-pointer font-sans text-sm font-bold text-[var(--muted)]"
                  onClick={(e) => {
                    e.preventDefault();
                    field.onChange(!field.value);
                  }}
                >
                  Remember this device
                </label>
              </div>
            )}
          />

          <ChunkyButton
            type="submit"
            variant="primary"
            disabled={isPending}
            className="w-full"
          >
            <LogIn aria-hidden="true" />
            {isPending ? 'signing_in...' : 'sign_in →'}
          </ChunkyButton>
        </form>
      </div>

      <p className="text-center text-sm text-muted mt-6">
        No account?{' '}
        <a href="#" className="text-primary hover:underline">
          Request access
        </a>
      </p>
    </div>
  );
}
