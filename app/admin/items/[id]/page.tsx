import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { ItemForm, type ItemFormValues } from '@/components/admin/item-form';

export const metadata: Metadata = { title: 'Muokkaa tuotetta' };

export default async function EditItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [item, categories] = await Promise.all([
    prisma.item.findUnique({
      where: { id },
      include: { questions: { orderBy: { sortOrder: 'asc' } } },
    }),
    prisma.category.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
  ]);
  if (!item) notFound();

  const formValues: ItemFormValues = {
    id: item.id,
    name: item.name,
    slug: item.slug,
    categoryId: item.categoryId,
    priceCents: item.priceCents,
    stock: item.stock,
    imageUrl: item.imageUrl,
    description: item.description,
    sortOrder: item.sortOrder,
    active: item.active,
    featured: item.featured,
    isEvent: item.isEvent,
    startsAt: item.startsAt ? item.startsAt.toISOString().slice(0, 10) : null,
    endsAt: item.endsAt ? item.endsAt.toISOString().slice(0, 10) : null,
    hidden: item.hidden,
    leaderDiscount: item.leaderDiscount,
    questions: item.questions.map((q) => ({
      id: q.id,
      prompt: q.prompt,
      type: q.type,
      required: q.required,
      options: q.options as string[],
    })),
  };

  return (
    <div>
      <Link
        href="/admin/items"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> Tuotteet
      </Link>
      <h1 className="mb-6 text-2xl font-bold">Muokkaa tuotetta</h1>
      <ItemForm categories={categories} item={formValues} />
    </div>
  );
}
