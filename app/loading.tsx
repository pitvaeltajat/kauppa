import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="container py-8" aria-busy="true">
      <Skeleton className="h-56 w-full rounded-xl sm:h-72" />
      <div className="grid gap-4 py-8 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="rounded-lg border bg-card p-5 shadow-sm">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="mt-3 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-4/5" />
            <div className="mt-5 space-y-2">
              {Array.from({ length: 3 }, (_, row) => <Skeleton key={row} className="h-12 w-full" />)}
            </div>
            <Skeleton className="mt-5 h-4 w-1/2" />
          </div>
        ))}
      </div>
      <div className="border-t py-8"><Skeleton className="mb-5 h-7 w-32" /><div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="overflow-hidden rounded-lg border bg-card"><Skeleton className="aspect-square w-full rounded-none" /><div className="space-y-2 p-4"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /></div></div>)}</div></div>
    </div>
  );
}
