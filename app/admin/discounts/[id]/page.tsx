import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { DiscountForm, type DiscountFormValues } from '@/components/admin/discount-form';
import { requireSuperAdmin } from '@/lib/admin-guard';

export const metadata: Metadata = { title: 'Muokkaa alennuskoodia' };

export default async function EditDiscountPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSuperAdmin();
  const { id } = await params;
  const code = await prisma.discountCode.findUnique({ where: { id } });
  if (!code) notFound();

  const values: DiscountFormValues = {
    id: code.id,
    code: code.code,
    description: code.description,
    percentOff: code.percentOff,
    leaderOnly: code.leaderOnly,
    active: code.active,
    validUntil: code.validUntil ? code.validUntil.toISOString().slice(0, 10) : null,
  };

  return (
    <div>
      <Link
        href="/admin/discounts"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> Alennuskoodit
      </Link>
      <h1 className="mb-6 text-2xl font-bold">Muokkaa alennuskoodia</h1>
      <DiscountForm discount={values} />
    </div>
  );
}
