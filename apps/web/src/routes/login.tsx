import { createFileRoute } from '@tanstack/react-router';
import { LoginForm } from '@/modules/auth';
import { useThemeStore } from '@/store/themeStore';

export const Route = createFileRoute('/login')({
  component: LoginPage,
});

export function LoginPage() {
  const toggleTheme = useThemeStore((state) => state.toggleTheme);

  return (
    <div className="relative min-h-screen">
      <button
        onClick={toggleTheme}
        type="button"
        className="fixed top-4 right-4 z-20 text-xs px-2.5 py-1 rounded border border-c text-muted mono cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition"
      >
        theme
      </button>

      <div className="min-h-screen flex flex-col md:flex-row">
        {/* Left panel */}
        <div className="hidden md:flex md:w-1/2 bg-panel border-r border-c relative overflow-hidden flex-col justify-between p-10 grid-pattern">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded border border-c bg-primary flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 4h16v6H4zM4 14h10v6H4z"
                  fill="currentColor"
                  className="text-primary-fg"
                />
              </svg>
            </div>
            <span className="font-semibold mono text-sm">monoRepo</span>
          </div>

          <div>
            <div className="text-xs mono text-muted mb-3">
              // monorepo starter, deep modules pattern
            </div>
            <blockquote className="text-2xl font-medium leading-snug max-w-md">
              &quot;One workspace. Every app shares the same contracts, the same
              components, the same rules.&quot;
            </blockquote>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="#"
              aria-label="GitHub"
              className="w-8 h-8 rounded border border-c flex items-center justify-center text-muted hover:text-current hover:bg-black/5 dark:hover:bg-white/5 transition"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.57.1.78-.25.78-.55 0-.27-.01-1.16-.02-2.11-3.2.7-3.87-1.36-3.87-1.36-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.17.08 1.78 1.2 1.78 1.2 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 015.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.24 2.76.12 3.05.74.8 1.18 1.83 1.18 3.09 0 4.43-2.69 5.41-5.25 5.69.41.36.78 1.07.78 2.15 0 1.55-.01 2.8-.01 3.18 0 .3.2.66.79.55A10.51 10.51 0 0023.5 12c0-6.35-5.15-11.5-11.5-11.5z" />
              </svg>
            </a>
            <a
              href="#"
              aria-label="LinkedIn"
              className="w-8 h-8 rounded border border-c flex items-center justify-center text-muted hover:text-current hover:bg-black/5 dark:hover:bg-white/5 transition"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.38-1.85 3.61 0 4.28 2.38 4.28 5.47v6.27zM5.34 7.43a2.07 2.07 0 110-4.14 2.07 2.07 0 010 4.14zM7.12 20.45H3.56V9h3.56v11.45z" />
              </svg>
            </a>
            <a
              href="#"
              aria-label="Instagram"
              className="w-8 h-8 rounded border border-c flex items-center justify-center text-muted hover:text-current hover:bg-black/5 dark:hover:bg-white/5 transition"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="2" y="2" width="20" height="20" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle
                  cx="17.5"
                  cy="6.5"
                  r="1"
                  fill="currentColor"
                  stroke="none"
                />
              </svg>
            </a>
          </div>
        </div>

        {/* Right panel: form */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-sm">
            <div className="mb-8 md:hidden flex items-center gap-2">
              <div className="w-7 h-7 rounded border border-c bg-primary flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M4 4h16v6H4zM4 14h10v6H4z"
                    fill="currentColor"
                    className="text-primary-fg"
                  />
                </svg>
              </div>
              <span className="font-semibold mono text-sm">monoRepo</span>
            </div>

            <LoginForm />
          </div>
        </div>
      </div>
    </div>
  );
}
