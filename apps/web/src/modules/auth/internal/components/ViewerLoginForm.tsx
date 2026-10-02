import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { toast } from 'sonner';
import { ChunkyInput } from '@/components/ui/chunky-input';
import { ChunkyButton } from '@/components/ui/chunky-button';
import { ChunkyCheckbox } from '@/components/ui/chunky-checkbox';
import { ChunkyCard } from '@/components/ui/chunky-card';
import {
  ChunkyDialog,
  ChunkyDialogContent,
  ChunkyDialogHeader,
  ChunkyDialogTitle,
  ChunkyDialogDescription,
  ChunkyDialogBody,
  ChunkyDialogFooter,
} from '@/components/ui/chunky-dialog';
import { loginSchema, type LoginSchema } from '../schema';

export interface ViewerLoginFormProps {
  onSuccess?: (values: LoginSchema) => void;
}

export function ViewerLoginForm({ onSuccess }: ViewerLoginFormProps) {
  const [showPassword, setShowPassword] = React.useState(false);
  const [forgotOpen, setForgotOpen] = React.useState(false);
  const [inviteOpen, setInviteOpen] = React.useState(false);

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
    // Mock UI-only submission — deliberately no backend call.
    toast.success('Welcome back! This is a demo login.');
    onSuccess?.(values);
  };

  return (
    <ChunkyCard data-testid="viewer-login-card" className="w-full p-6 sm:p-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-extrabold text-[var(--ink)]">
          Welcome back, movie lover
        </h1>
        <p className="mt-1 font-sans text-sm font-semibold text-[var(--muted)]">
          Sign in to continue watching.
        </p>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
        noValidate
      >
        <div>
          <label
            htmlFor="viewer-email"
            className="mb-1.5 block font-sans text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]"
          >
            Email
          </label>
          <ChunkyInput
            id="viewer-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={Boolean(errors.email)}
            disabled={isSubmitting}
            {...register('email')}
          />
          {errors.email && (
            <p className="mt-1 font-sans text-xs font-bold text-[var(--red)]">
              {errors.email.message}
            </p>
          )}
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label
              htmlFor="viewer-password"
              className="block font-sans text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]"
            >
              Password
            </label>
            <button
              type="button"
              onClick={() => setForgotOpen(true)}
              className="cursor-pointer font-sans text-xs font-extrabold text-[var(--green-dark)] hover:underline"
            >
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <ChunkyInput
              id="viewer-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              aria-invalid={Boolean(errors.password)}
              disabled={isSubmitting}
              className="pr-12"
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              disabled={isSubmitting}
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

        <Controller
          control={control}
          name="rememberThisDevice"
          render={({ field }) => (
            <div className="flex items-center gap-2.5">
              <ChunkyCheckbox
                id="viewer-remember"
                aria-label="Remember this device"
                checked={Boolean(field.value)}
                onCheckedChange={field.onChange}
                disabled={isSubmitting}
              />
              <label
                htmlFor="viewer-remember"
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
          disabled={isSubmitting}
          className="mt-1 w-full"
        >
          <LogIn aria-hidden="true" />
          {isSubmitting ? 'Signing in...' : 'Sign in'}
        </ChunkyButton>
      </form>

      <p className="mt-6 text-center font-sans text-sm font-semibold text-[var(--muted)]">
        Don&apos;t have an account?{' '}
        <button
          type="button"
          onClick={() => setInviteOpen(true)}
          className="cursor-pointer font-extrabold text-[var(--green-dark)] hover:underline"
        >
          Ask for an invite
        </button>
      </p>

      <ChunkyDialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <ChunkyDialogContent aria-describedby={undefined}>
          <ChunkyDialogHeader>
            <ChunkyDialogTitle>Need an account?</ChunkyDialogTitle>
            <ChunkyDialogDescription>
              Accounts are created by your admin.
            </ChunkyDialogDescription>
          </ChunkyDialogHeader>
          <ChunkyDialogBody>
            <p className="font-sans text-sm font-semibold text-[var(--ink)]">
              Please contact your administrator or the person who invited you
              to request access. Share the email address you&apos;d like to
              sign in with so they can set up your account.
            </p>
          </ChunkyDialogBody>
          <ChunkyDialogFooter>
            <ChunkyButton
              type="button"
              variant="primary"
              onClick={() => setInviteOpen(false)}
            >
              Got it
            </ChunkyButton>
          </ChunkyDialogFooter>
        </ChunkyDialogContent>
      </ChunkyDialog>

      <ChunkyDialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <ChunkyDialogContent aria-describedby={undefined}>
          <ChunkyDialogHeader>
            <ChunkyDialogTitle>Forgot your password?</ChunkyDialogTitle>
            <ChunkyDialogDescription>
              Password resets are handled by your admin.
            </ChunkyDialogDescription>
          </ChunkyDialogHeader>
          <ChunkyDialogBody>
            <p className="font-sans text-sm font-semibold text-[var(--ink)]">
              Please contact your administrator or the person who invited you
              to reset your password. Include the email address you signed up
              with so they can find your account quickly.
            </p>
          </ChunkyDialogBody>
          <ChunkyDialogFooter>
            <ChunkyButton
              type="button"
              variant="primary"
              onClick={() => setForgotOpen(false)}
            >
              Got it
            </ChunkyButton>
          </ChunkyDialogFooter>
        </ChunkyDialogContent>
      </ChunkyDialog>
    </ChunkyCard>
  );
}
