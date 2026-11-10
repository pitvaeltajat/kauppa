import { Skeleton } from '@/components/ui/skeleton';

export default function ItemLoading() {
  return <div className="container py-8" aria-busy="true"><Skeleton className="mb-6 h-4 w-72 max-w-full" /><div className="grid gap-8 md:grid-cols-2"><Skeleton className="aspect-square w-full rounded-lg" /><div><Skeleton className="h-4 w-28" /><Skeleton className="mt-2 h-9 w-3/4" /><Skeleton className="mt-4 h-9 w-32" /><Skeleton className="mt-6 h-24 w-full" /><Skeleton className="mt-6 h-12 w-full rounded-md" /><div className="mt-8 rounded-lg border p-5"><Skeleton className="h-4 w-24" /><Skeleton className="mt-3 h-4 w-full" /><Skeleton className="mt-2 h-4 w-5/6" /></div></div></div></div>;
}
