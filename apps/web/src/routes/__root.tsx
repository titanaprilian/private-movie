import { createRootRoute, Outlet } from '@tanstack/react-router';
import { useAuth } from '@/modules/auth';
import { Shell } from '@/modules/shell';
import { Toaster } from '@/components/ui/sonner';

export const Route = createRootRoute({
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
