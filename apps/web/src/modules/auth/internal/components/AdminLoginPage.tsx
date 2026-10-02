import { useUIStore } from '@/store/uiStore';
import { AdminLoginForm, type AdminLoginFormProps } from './AdminLoginForm';
import { AdminLoginShowcase } from './AdminLoginShowcase';

export type AdminLoginPageProps = AdminLoginFormProps;

export function AdminLoginPage(props: AdminLoginPageProps) {
  // Dark logo variant keeps the wordmark readable on light backgrounds.
  const theme = useUIStore((s) => s.theme);
  const brandLogoSrc =
    theme === 'light' ? '/assets/logo-full-dark.png' : '/assets/logo-full.png';

  return (
    <div
      data-testid="admin-login-page"
      className="flex min-h-screen bg-[var(--bg)]"
    >
      <AdminLoginShowcase />
      <div className="flex w-full flex-1 items-center justify-center p-4 sm:p-8 lg:w-1/2">
        <div className="w-full max-w-md">
          <div
            data-testid="admin-login-mobile-header"
            className="mb-6 flex items-center justify-center lg:hidden"
          >
            <img
              src={brandLogoSrc}
              alt="Private Movie"
              className="h-12 w-auto"
            />
          </div>
          <AdminLoginForm {...props} />
        </div>
      </div>
    </div>
  );
}
