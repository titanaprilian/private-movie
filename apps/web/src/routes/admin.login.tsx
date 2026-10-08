import { createFileRoute, redirect } from '@tanstack/react-router';
import { AdminLoginPage, checkAuthSession } from '@/modules/auth';

export const Route = createFileRoute('/admin/login')({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
  beforeLoad: async ({ search }) => {
    const isAuthenticated = await checkAuthSession();

    if (isAuthenticated) {
      throw redirect({
        to: search.redirect ?? '/admin',
      });
    }
  },
  component: AdminLoginPageRoute,
});

export function AdminLoginPageRoute() {
  return <AdminLoginPage />;
}
