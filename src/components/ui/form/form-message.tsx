import { cn } from '@/lib/utils';

interface FormMessageProps {
  type: 'success' | 'error';
  message: string;
  className?: string;
}

export function FormMessage({ type, message, className }: FormMessageProps) {
  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      className={cn(
        'rounded-lg px-4 py-3 text-sm',
        type === 'success' && 'bg-primary/5 text-primary ring-1 ring-primary/20',
        type === 'error' && 'bg-destructive/10 text-destructive ring-1 ring-destructive/20',
        className,
      )}
    >
      {message}
    </div>
  );
}
