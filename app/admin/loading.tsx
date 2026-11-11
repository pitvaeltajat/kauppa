import { Skeleton } from '@/components/ui/skeleton';

export default function AdminLoading() {
  return (
    <div aria-busy="true">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-10 w-28" />
      </div>
      <div className="mb-6 flex gap-2">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-8 w-24" />
        ))}
      </div>
      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <Skeleton className="h-11 w-full rounded-none" />
        {Array.from({ length: 7 }, (_, index) => (
          <div key={index} className="flex gap-4 border-t p-4">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="ml-auto h-8 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
