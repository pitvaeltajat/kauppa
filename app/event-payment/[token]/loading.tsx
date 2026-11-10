import { Skeleton } from '@/components/ui/skeleton';

export default function EventPaymentLoading() { return <div className="container flex justify-center py-12" aria-busy="true"><div className="w-full max-w-2xl rounded-lg border bg-card p-6"><Skeleton className="mx-auto size-12 rounded-full" /><Skeleton className="mx-auto mt-4 h-7 w-52" /><Skeleton className="mt-6 h-28 w-full" /><Skeleton className="mt-5 h-6 w-40" /><Skeleton className="mt-3 h-24 w-full" /><Skeleton className="mt-5 h-6 w-40" /><Skeleton className="mt-3 h-40 w-full" /></div></div>; }
