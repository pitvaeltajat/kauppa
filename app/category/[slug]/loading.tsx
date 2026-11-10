import { Skeleton } from '@/components/ui/skeleton';

export default function CategoryLoading() {
  return <div className="container py-8" aria-busy="true"><Skeleton className="mb-4 h-4 w-44" /><Skeleton className="h-8 w-56" /><Skeleton className="mt-2 h-4 w-96 max-w-full" /><div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <div key={index} className="overflow-hidden rounded-lg border bg-card"><Skeleton className="aspect-square w-full rounded-none" /><div className="space-y-2 p-4"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /><Skeleton className="h-3 w-full" /></div></div>)}</div></div>;
}
