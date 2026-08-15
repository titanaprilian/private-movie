import { Toaster as Sonner } from 'sonner';
import { useThemeStore } from '@/store/themeStore';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const toastIcons = {
  success: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#22c55e"
      strokeWidth="2"
      className="shrink-0 mt-0.5"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12l3 3 5-6" />
    </svg>
  ),
  error: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#ef4444"
      strokeWidth="2"
      className="shrink-0 mt-0.5"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M15 9l-6 6M9 9l6 6" />
    </svg>
  ),
  info: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#818cf8"
      strokeWidth="2"
      className="shrink-0 mt-0.5"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  ),
  warning: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#f59e0b"
      strokeWidth="2"
      className="shrink-0 mt-0.5"
    >
      <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  ),
};

const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useThemeStore((state) => state.theme);

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      position="bottom-right"
      icons={toastIcons}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast mono w-[320px] bg-[var(--card)] text-[var(--fg)] border border-[var(--border)] border-l-[3px] rounded-[6px] p-[0.7rem_0.875rem] flex gap-[0.625rem] items-start shadow-[0_4px_14px_rgba(0,0,0,0.08)]',
          title: 'text-xs text-[var(--muted)] mono font-normal',
          description: 'text-sm mt-0.5 text-[var(--fg)] mono font-normal',
          success:
            'group-[.toaster]:border-l-[#22c55e] [border-left-color:#22c55e]',
          error:
            'group-[.toaster]:border-l-[#ef4444] [border-left-color:#ef4444]',
          info: 'group-[.toaster]:border-l-[#818cf8] [border-left-color:#818cf8]',
          warning:
            'group-[.toaster]:border-l-[#f59e0b] [border-left-color:#f59e0b]',
          closeButton: 'text-[var(--muted)] hover:text-current shrink-0 mt-0.5',
          actionButton:
            'group-[.toast]:bg-[var(--primary)] group-[.toast]:text-[var(--primary-fg)]',
          cancelButton:
            'group-[.toast]:bg-[var(--hover)] group-[.toast]:text-[var(--muted)]',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
export default Toaster;
