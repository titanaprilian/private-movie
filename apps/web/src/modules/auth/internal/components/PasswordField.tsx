import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { ChunkyInput } from '@/components/ui/chunky-input';
import type { UseFormRegisterReturn } from 'react-hook-form';

export interface PasswordFieldProps {
  id: string;
  label?: string;
  labelExtra?: React.ReactNode;
  error?: string;
  disabled?: boolean;
  registration: UseFormRegisterReturn;
}

export function PasswordField({
  id,
  label = 'Password',
  labelExtra,
  error,
  disabled,
  registration,
}: PasswordFieldProps) {
  const [showPassword, setShowPassword] = React.useState(false);

  return (
    <div>
      {labelExtra ? (
        <div className="mb-1.5 flex items-center justify-between">
          <label
            htmlFor={id}
            className="block font-sans text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]"
          >
            {label}
          </label>
          {labelExtra}
        </div>
      ) : (
        <label
          htmlFor={id}
          className="mb-1.5 block font-sans text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]"
        >
          {label}
        </label>
      )}
      <div className="relative">
        <ChunkyInput
          id={id}
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          placeholder="••••••••"
          aria-invalid={Boolean(error)}
          disabled={disabled}
          className="pr-12"
          {...registration}
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          aria-pressed={showPassword}
          disabled={disabled}
          className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-xl text-[var(--muted)] transition-colors hover:bg-[var(--surface-raised)] hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {showPassword ? (
            <EyeOff className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Eye className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
      </div>
      {error && (
        <p className="mt-1 font-sans text-xs font-bold text-[var(--red)]">
          {error}
        </p>
      )}
    </div>
  );
}
