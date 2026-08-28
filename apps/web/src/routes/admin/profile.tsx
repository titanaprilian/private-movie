import { createFileRoute } from '@tanstack/react-router';
import { ProfileView } from '@/modules/profile';

export const Route = createFileRoute('/admin/profile')({
  component: ProfilePage,
});

export function ProfilePage() {
  return <ProfileView />;
}
