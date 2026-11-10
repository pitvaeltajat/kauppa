import { Skeleton } from '@/components/ui/skeleton';

export default function LoginLoading() { return <div className="mx-auto w-full max-w-sm px-6" aria-busy="true"><div className="rounded-lg border bg-card p-6"><Skeleton className="mx-auto h-8 w-32" /><Skeleton className="mt-6 h-11 w-full" /><Skeleton className="mt-3 h-10 w-full" /></div></div>; }
