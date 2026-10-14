import { createRootRoute, Outlet } from '@tanstack/react-router';
import { Toaster } from '@/components/ui/chunky-sonner';

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <>
      <Outlet />
      <Toaster />
    </>
  );
}

