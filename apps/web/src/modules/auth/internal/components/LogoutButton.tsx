import React from 'react';
import { useNavigate } from '@tanstack/react-router';
import { LogOut } from 'lucide-react';
import { ChunkyButton } from '@/components/ui/chunky-button';
import { useAuthStore } from '../store';

export interface LogoutButtonProps {
  className?: string;
  onLogoutSuccess?: () => void;
}

export const LogoutButton: React.FC<LogoutButtonProps> = ({
  className = '',
  onLogoutSuccess,
}) => {
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    if (onLogoutSuccess) {
      onLogoutSuccess();
    } else {
      navigate({ to: '/login' });
    }
  };

  return (
    <ChunkyButton
      type="button"
      variant="outline"
      size="sm"
      onClick={handleLogout}
      className={className}
    >
      <LogOut aria-hidden="true" />
      <span>Logout</span>
    </ChunkyButton>
  );
};
