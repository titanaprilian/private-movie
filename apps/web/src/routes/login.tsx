import { createFileRoute } from '@tanstack/react-router';
import { LoginForm } from '@/modules/auth';

export const Route = createFileRoute('/login')({
  component: LoginPage,
});

export function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <LoginForm />
    </div>
  );
}
