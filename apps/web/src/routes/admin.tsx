import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { checkAuthSession } from '@/modules/auth';
import { Shell } from '@/modules/shell';

export const Route = createFileRoute('/admin')({
  beforeLoad: async () => {
    const isAuthenticated = await checkAuthSession();

    if (!isAuthenticated) {
      throw redirect({
        to: '/login',
      });
    }
  },
  component: AdminPage,
});

export function AdminPage() {
  return (
    <Shell>
      <Outlet />
    </Shell>
  );
}


