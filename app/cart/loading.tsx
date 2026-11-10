import { Skeleton } from '@/components/ui/skeleton';

export default function CartLoading() {
  return <div className="container py-8" aria-busy="true"><Skeleton className="mb-6 h-8 w-40" /><div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]"><div className="space-y-3">{Array.from({ length: 2 }, (_, index) => <div key={index} className="rounded-lg border bg-card p-4"><div className="flex gap-4"><Skeleton className="size-20 shrink-0" /><div className="flex-1 space-y-3"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-4 w-1/3" /><Skeleton className="h-8 w-24" /></div></div></div>)}</div><div className="h-80 rounded-lg border bg-card p-5"><Skeleton className="h-6 w-32" /><Skeleton className="mt-6 h-4 w-full" /><Skeleton className="mt-3 h-10 w-full" /><Skeleton className="mt-6 h-12 w-full" /></div></div></div>;
}
