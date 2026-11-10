import { Skeleton } from '@/components/ui/skeleton';

export default function KammiLoading() {
  return <div className="container py-8" aria-busy="true"><Skeleton className="h-8 w-48" /><Skeleton className="mt-3 h-4 w-full max-w-2xl" /><div className="mt-5 grid gap-4 sm:grid-cols-2"><Skeleton className="h-24 rounded-lg" /><Skeleton className="h-24 rounded-lg" /></div><div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]"><div className="rounded-lg border bg-card p-5"><Skeleton className="h-6 w-40" /><Skeleton className="mt-5 h-10 w-full" /><div className="mt-6 grid grid-cols-7 gap-2">{Array.from({ length: 35 }, (_, index) => <Skeleton key={index} className="h-10" />)}</div></div><div className="rounded-lg border bg-card p-5"><Skeleton className="h-6 w-28" />{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="mt-4 h-10 w-full" />)}</div></div></div>;
}
