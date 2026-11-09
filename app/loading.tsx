import { LoadingPill } from '@/components/ui/loading-pill';

export default function Loading() {
  return (
    <div className="container py-8" aria-busy="true">
      <LoadingPill className="mb-6 h-7 w-48 bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="rounded-lg border bg-card p-4 shadow-sm">
            <LoadingPill className="mb-4 h-4 w-2/3 bg-muted" />
            <LoadingPill className="mb-2 h-3 w-1/2 bg-muted" />
            <LoadingPill className="h-3 w-1/3 bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
