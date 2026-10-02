import { createFileRoute } from '@tanstack/react-router';
import { AdminLoginPage } from '@/modules/auth';

export const Route = createFileRoute('/admin/login')({
  component: AdminLoginPageRoute,
});

export function AdminLoginPageRoute() {
  return <AdminLoginPage />;
}
