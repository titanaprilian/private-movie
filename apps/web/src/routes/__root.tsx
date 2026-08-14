import { createRootRoute, Outlet, redirect } from '@tanstack/react-router';
import { useAuth, useAuthStore } from '@/modules/auth';
import { Shell } from '@/modules/shell';
import { Toaster } from '@/components/ui/sonner';

export const Route = createRootRoute({
  beforeLoad: async ({ location }) => {
    const isPublicRoute =
      location.pathname === '/login' || location.pathname === '/register';

    const store = useAuthStore.getState();

    if (!store.isAuthenticated && !store.user) {
      await store.checkAuth();
    }

    const updatedIsAuthenticated = useAuthStore.getState().isAuthenticated;

    if (!isPublicRoute && !updatedIsAuthenticated) {
      throw redirect({
        to: '/login',
      });
    }

    if (isPublicRoute && updatedIsAuthenticated) {
      throw redirect({
        to: '/',
      });
    }
  },
  component: RootComponent,
});

function RootComponent() {
  const { isAuthenticated } = useAuth();

  return (
    <>
      {isAuthenticated ? (
        <Shell>
          <Outlet />
        </Shell>
      ) : (
        <Outlet />
      )}
      <Toaster />
    </>
  );
}
