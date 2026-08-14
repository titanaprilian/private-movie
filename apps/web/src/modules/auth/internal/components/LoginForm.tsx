import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
        navigate({ to: '/' });
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
            className="mb-4 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400"
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
            <Label
              htmlFor="email"
              className="block text-xs mono text-muted mb-1.5 uppercase tracking-wide"
            >
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              disabled={isPending}
              className="mono"
              {...register('email')}
            />
            {errors.email && (
              <p className="mt-1 text-xs text-red-500 dark:text-red-400">
                {errors.email.message}
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label
                htmlFor="password"
                className="block text-xs mono text-muted uppercase tracking-wide"
              >
                Password
              </Label>
              <a href="#" className="text-xs text-primary hover:underline">
                forgot?
              </a>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              disabled={isPending}
              className="mono"
              {...register('password')}
            />
            {errors.password && (
              <p className="mt-1 text-xs text-red-500 dark:text-red-400">
                {errors.password.message}
              </p>
            )}
          </div>

          <Label className="flex items-center gap-2 text-sm text-muted font-normal cursor-pointer">
            <Checkbox
              id="rememberThisDevice"
              disabled={isPending}
              {...register('rememberThisDevice')}
            />
            Remember this device
          </Label>

          <Button type="submit" disabled={isPending} className="w-full mono">
            {isPending ? 'signing_in...' : 'sign_in →'}
          </Button>
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
