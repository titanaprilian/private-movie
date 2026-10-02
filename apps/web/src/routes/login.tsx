import { createFileRoute } from '@tanstack/react-router';
import { ViewerLoginPage } from '@/modules/auth';

export const Route = createFileRoute('/login')({
  component: LoginPage,
});

export function LoginPage() {
  return <ViewerLoginPage />;
}
