import { createFileRoute } from '@tanstack/react-router';
import { DashboardView } from '@/modules/dashboard';

export const Route = createFileRoute('/admin/')({
  component: DashboardPage,
});

export function DashboardPage() {
  return <DashboardView />;
}
