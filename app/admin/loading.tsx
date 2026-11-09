import { LoadingPill } from '@/components/ui/loading-pill';

export default function AdminLoading() {
  return (
    <div className="container flex flex-col gap-6 py-6 md:flex-row md:gap-8" aria-busy="true">
      <aside className="md:w-52 md:shrink-0">
        <LoadingPill className="mb-3 h-4 w-20 bg-muted" />
        <div className="flex gap-2 md:flex-col">
          {Array.from({ length: 5 }, (_, index) => (
            <LoadingPill key={index} className="h-8 w-24 bg-muted md:w-full" />
          ))}
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        <LoadingPill className="mb-6 h-7 w-40 bg-muted" />
        <div className="space-y-3">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="rounded-lg border bg-card p-4 shadow-sm">
              <LoadingPill className="mb-3 h-4 w-1/3 bg-muted" />
              <LoadingPill className="h-3 w-2/3 bg-muted" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
