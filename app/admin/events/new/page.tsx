import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { ItemForm } from '@/components/admin/item-form';
import { requireEventAdmin } from '@/lib/admin-guard';

export const metadata: Metadata = { title: 'Uusi tapahtuma' };

export default async function NewEventPage() {
  await requireEventAdmin();
  return (
    <div>
      <Link
        href="/admin/events"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> Tapahtumat
      </Link>
      <h1 className="mb-6 text-2xl font-bold">Uusi tapahtuma</h1>
      <ItemForm categories={[]} eventMode />
    </div>
  );
}
