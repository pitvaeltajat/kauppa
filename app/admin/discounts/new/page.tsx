import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { DiscountForm } from '@/components/admin/discount-form';
import { requireSuperAdmin } from '@/lib/admin-guard';

export const metadata: Metadata = { title: 'Uusi alennuskoodi' };

export default async function NewDiscountPage() {
  await requireSuperAdmin();
  return (
    <div>
      <Link
        href="/admin/discounts"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> Alennuskoodit
      </Link>
      <h1 className="mb-6 text-2xl font-bold">Uusi alennuskoodi</h1>
      <DiscountForm />
    </div>
  );
}
