import {
  createFileRoute,
  Outlet,
  redirect,
  useLocation,
} from '@tanstack/react-router';
import { checkAuthSession } from '@/modules/auth';
import { Shell } from '@/modules/shell';

export const Route = createFileRoute('/admin')({
  beforeLoad: async ({ location }) => {
    // The admin login page shares the /admin URL prefix but must stay
    // publicly accessible — otherwise unauthenticated sessions would loop.
    if (location?.pathname === '/admin/login') {
      return;
    }

    const isAuthenticated = await checkAuthSession();

    if (!isAuthenticated) {
      throw redirect({
        to: '/admin/login',
      });
    }
  },
  component: AdminPage,
});

export function AdminPage() {
  const location = useLocation();

  // Rendered without the Shell so the gatekeeper login stands alone.
  if (location.pathname === '/admin/login') {
    return <Outlet />;
  }

  return (
    <Shell>
      <Outlet />
    </Shell>
  );
}


