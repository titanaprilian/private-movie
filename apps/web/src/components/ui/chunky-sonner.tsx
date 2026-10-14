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

const toastIcons = {
  success: (
    <CheckCircle2
      className="toast-icon toast-icon-success size-[18px] shrink-0 text-[var(--green)]"
      aria-hidden
    />
  ),
  error: (
    <AlertCircle
      className="toast-icon toast-icon-error size-[18px] shrink-0 text-[var(--red)]"
      aria-hidden
    />
  ),
  info: (
    <Info
      className="toast-icon toast-icon-info size-[18px] shrink-0 text-[var(--blue)]"
      aria-hidden
    />
  ),
  warning: (
    <AlertTriangle
      className="toast-icon toast-icon-warning size-[18px] shrink-0 text-[var(--gold)]"
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
      toastOptions={{
        classNames: {
          toast:
            'group toast font-sans bg-[var(--surface)] text-[var(--ink)] border-2 border-b-4 rounded-2xl shadow-xl p-4 flex gap-2.5 items-start',
          title: 'font-display font-bold text-[var(--ink)]',
          description: 'font-sans text-sm mt-0.5 text-[var(--muted)]',
          success:
            'border-[var(--green)] border-b-[var(--green-dark)]',
          error: 'border-[var(--red)] border-b-[var(--red-dark)]',
          info: 'border-[var(--blue)] border-b-[var(--blue-dark)]',
          warning:
            'border-[var(--gold)] border-b-[var(--gold-dark)]',
          closeButton:
            'bg-[var(--surface-raised)] text-[var(--muted)] border-[var(--border)] hover:text-[var(--ink)] shrink-0',
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
