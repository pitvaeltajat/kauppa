import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { ItemForm } from '@/components/admin/item-form';

export const metadata: Metadata = { title: 'Uusi tuote' };

export default async function NewItemPage() {
  const [categories, accountingClasses] = await Promise.all([
    prisma.category.findMany({ where: { slug: { not: 'tapahtumat' } }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    prisma.accountingClass.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
  ]);

  return (
    <div>
      <Link
        href="/admin/items"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> Tuotteet
      </Link>
      <h1 className="mb-6 text-2xl font-bold">Uusi tuote</h1>
      <ItemForm categories={categories} accountingClasses={accountingClasses} />
    </div>
  );
}
