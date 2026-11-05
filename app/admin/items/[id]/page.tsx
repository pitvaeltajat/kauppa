import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { ItemForm } from '@/components/admin/item-form';

export const metadata: Metadata = { title: 'Muokkaa tuotetta' };

export default async function EditItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [item, categories] = await Promise.all([
    prisma.item.findUnique({ where: { id } }),
    prisma.category.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
  ]);
  if (!item) notFound();

  return (
    <div>
      <Link
        href="/admin/items"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> Tuotteet
      </Link>
      <h1 className="mb-6 text-2xl font-bold">Muokkaa tuotetta</h1>
      <ItemForm categories={categories} item={item} />
    </div>
  );
}
