import { createFileRoute } from '@tanstack/react-router';
import { StorageView } from '@/modules/storage';

export const Route = createFileRoute('/admin/storage')({
  component: StoragePage,
});

export function StoragePage() {
  return <StorageView />;
}
