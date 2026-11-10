import { cn } from '@/lib/cn';

/** Layout-preserving loading block used by route loading boundaries. */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn('block animate-pulse rounded-md bg-muted', className)} />;
}
