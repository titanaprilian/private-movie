import { Toaster as Sonner } from 'sonner';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
} from 'lucide-react';
import { useUIStore } from '@/store/uiStore';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const iconBadgeClassName =
  '!size-9 !h-9 !w-9 shrink-0 flex items-center justify-center !items-center !justify-center [&_svg]:!m-auto rounded-xl border border-black/5 dark:border-white/10 bg-white/70 dark:bg-black/20 shadow-sm mr-3.5';

const toastIcons = {
  success: (
    <CheckCircle2
      className="toast-icon toast-icon-success size-5 shrink-0 text-[var(--green)]"
      aria-hidden
    />
  ),
  error: (
    <AlertCircle
      className="toast-icon toast-icon-error size-5 shrink-0 text-[var(--red)]"
      aria-hidden
    />
  ),
  info: (
    <Info
      className="toast-icon toast-icon-info size-5 shrink-0 text-[var(--blue)]"
      aria-hidden
    />
  ),
  warning: (
    <AlertTriangle
      className="toast-icon toast-icon-warning size-5 shrink-0 text-[var(--gold)]"
      aria-hidden
    />
  ),
  close: <X className="size-4 shrink-0" aria-hidden />,
};

const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useUIStore((state) => state.theme);

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      position="bottom-right"
      icons={toastIcons}
      className="toaster group"
      style={
        {
          '--normal-bg': 'var(--surface)',
          '--normal-text': 'var(--ink)',
          '--normal-border': 'var(--border)',
          '--border-radius': '16px',
        } as React.CSSProperties
      }
      toastOptions={{
        style: {
          '--normal-bg': 'var(--surface)',
          '--normal-text': 'var(--ink)',
          '--normal-border': 'var(--border)',
          '--border-radius': '16px',
        } as React.CSSProperties,
        classNames: {
          icon: iconBadgeClassName,
          toast:
            'group toast font-sans bg-[var(--surface)] text-[var(--ink)] border-2 border-b-4 border-[var(--border)] border-b-[var(--border-strong)] !rounded-2xl shadow-xl hover:-translate-y-[2px] hover:shadow-2xl cursor-pointer transition-all duration-150 p-4 flex gap-2.5 items-start',
          title:
            'font-display font-extrabold text-sm tracking-wide text-[var(--ink)]',
          description:
            'font-sans font-bold text-xs leading-relaxed mt-0.5 text-[var(--muted)]',
          success:
            '!bg-[var(--green-soft)] !border-[var(--green)] !border-b-[var(--green-dark)]',
          error:
            '!bg-[var(--red-soft)] !border-[var(--red)] !border-b-[var(--red-dark)]',
          info: '!bg-[var(--blue-soft)] !border-[var(--blue)] !border-b-[var(--blue-dark)]',
          warning:
            '!bg-[var(--gold-soft)] !border-[var(--gold)] !border-b-[var(--gold-dark)]',
          closeButton:
            'size-7 rounded-full border border-[var(--border)] bg-[var(--surface-raised)] hover:bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--ink)] flex items-center justify-center transition-all shrink-0',
          actionButton:
            'bg-[var(--green)] text-white border-2 border-b-4 border-[var(--green-dark)] rounded-xl font-extrabold uppercase text-xs px-3 py-1.5 cursor-pointer',
          cancelButton:
            'bg-[var(--surface-raised)] text-[var(--muted)] border-2 border-b-4 border-[var(--border)] rounded-xl font-extrabold uppercase text-xs px-3 py-1.5 cursor-pointer',
        },
      }}
      {...props}
    />
  );
};

export { Toaster, type ToasterProps };
export default Toaster;
