import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuth, LogoutButton, useAuthStore } from '@/modules/auth';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export function ProfileView() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogoutAll = async () => {
    await useAuthStore.getState().logoutAll();
    setIsOpen(false);
    navigate({ to: '/login' });
  };

  const formattedDate = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'N/A';

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-lg font-semibold text-fg">Profile</h1>
        <p className="text-xs text-muted mono">
          // view and manage your account details
        </p>
      </div>

      <div className="bg-card border border-c rounded">
        <div className="px-4 py-3 border-b border-c flex items-center justify-between">
          <h2 className="font-medium text-sm text-fg">Account Details</h2>
          <span className="text-xs mono px-2 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            Active Session
          </span>
        </div>

        <div className="p-4 space-y-4 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4 items-center">
            <span className="text-xs mono text-muted uppercase tracking-wide">
              Name
            </span>
            <span className="sm:col-span-2 font-medium text-fg">
              {user?.name || 'N/A'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4 items-center border-t border-c pt-4">
            <span className="text-xs mono text-muted uppercase tracking-wide">
              Email
            </span>
            <span className="sm:col-span-2 font-medium text-fg">
              {user?.email || 'N/A'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4 items-center border-t border-c pt-4">
            <span className="text-xs mono text-muted uppercase tracking-wide">
              Account Created
            </span>
            <span className="sm:col-span-2 mono text-xs text-fg">
              {formattedDate}
            </span>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-c bg-sidebar flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span className="text-xs text-muted">
            End your current session on this device or invalidate all active sessions
          </span>
          <div className="flex items-center gap-2">
            <LogoutButton />

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  Logout All Devices
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Logout All Devices</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to log out of all devices? This will invalidate all your current active sessions across all devices.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsOpen(false)}>
                    Cancel
                  </Button>
                  <Button variant="destructive" onClick={handleLogoutAll}>
                    Continue
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
    </div>
  );
}
