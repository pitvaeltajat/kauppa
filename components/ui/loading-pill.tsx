import { cn } from '@/lib/cn';

/** The shared loading treatment: a quiet, rounded skeleton pill. */
export function LoadingPill({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Ladataan"
      className={cn('inline-block h-3 w-20 animate-pulse rounded-full bg-current/20', className)}
    />
  );
}
