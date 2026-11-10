import { Skeleton } from '@/components/ui/skeleton';

export default function CancelLoading() { return <div className="container flex justify-center py-12" aria-busy="true"><div className="w-full max-w-xl rounded-lg border bg-card p-6 text-center"><Skeleton className="mx-auto size-12 rounded-full" /><Skeleton className="mx-auto mt-4 h-7 w-48" /><Skeleton className="mx-auto mt-4 h-16 w-full" /><div className="mt-5 flex justify-center gap-3"><Skeleton className="h-10 w-40" /><Skeleton className="h-10 w-40" /></div></div></div>; }
