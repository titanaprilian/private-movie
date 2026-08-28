import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { useAuthStore } from '@/modules/auth';

export const Route = createFileRoute('/admin')({
  beforeLoad: async () => {
    const store = useAuthStore.getState();

    if (!store.isAuthenticated && !store.user) {
      await store.checkAuth();
    }

    const updatedIsAuthenticated = useAuthStore.getState().isAuthenticated;

    if (!updatedIsAuthenticated) {
      throw redirect({
        to: '/login',
      });
    }
  },
  component: AdminPage,
});

export function AdminPage() {
  return <Outlet />;
}
