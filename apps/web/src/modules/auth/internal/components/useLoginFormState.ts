import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from '@tanstack/react-router';
import { useAuthStore } from '../store';
import { loginSchema, type LoginSchema } from '../schema';

export interface UseLoginFormStateOptions {
  onSuccess?: () => void;
  defaultRedirect?: string;
}

export function useLoginFormState({
  onSuccess,
  defaultRedirect = '/admin',
}: UseLoginFormStateOptions = {}) {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const authError = useAuthStore((state) => state.error);
  const isLoadingState = useAuthStore((state) => state.isLoading);

  const form = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberThisDevice: false,
    },
  });

  const onSubmit = async (values: LoginSchema) => {
    const success = await login(values);
    if (success) {
      if (onSuccess) {
        onSuccess();
      } else {
        navigate({ to: defaultRedirect });
      }
    }
    return success;
  };

  const isPending = form.formState.isSubmitting || isLoadingState;

  return {
    ...form,
    authError,
    isPending,
    onSubmit,
  };
}
