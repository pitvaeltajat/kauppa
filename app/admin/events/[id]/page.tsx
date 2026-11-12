import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { ItemForm, type ItemFormValues } from '@/components/admin/item-form';
import { requireEventAdmin } from '@/lib/admin-guard';

export const metadata: Metadata = { title: 'Muokkaa tapahtumaa' };

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  await requireEventAdmin();
  const { id } = await params;
  const [item, accountingClasses, users] = await Promise.all([
    prisma.item.findUnique({
      where: { id },
      include: {
        questions: { orderBy: { sortOrder: 'asc' } },
        variants: { orderBy: { sortOrder: 'asc' } },
      },
    }),
    prisma.accountingClass.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    prisma.user.findMany({
      where: { deletedAt: null },
      select: { email: true, name: true },
      orderBy: { email: 'asc' },
    }),
  ]);
  if (!item || !item.isEvent) notFound();

  const formValues: ItemFormValues = {
    id: item.id,
    name: item.name,
    slug: item.slug,
    categoryId: item.categoryId,
    accountingClassId: item.accountingClassId,
    stock: item.stock,
    imageUrl: item.imageUrl,
    description: item.description,
    sortOrder: item.sortOrder,
    active: item.active,
    featured: item.featured,
    notificationEmails: item.notificationEmails,
    createdByEmail: item.createdByEmail,
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
    variants: item.variants.map((variant) => ({
      id: variant.id,
      name: variant.name,
      priceCents: variant.priceCents,
    })),
  };

  return (
    <div>
      <Link
        href="/admin/events"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> Tapahtumat
      </Link>
      <h1 className="mb-6 text-2xl font-bold">Muokkaa tapahtumaa</h1>
      <ItemForm
        categories={[]}
        accountingClasses={accountingClasses}
        notificationUsers={users}
        item={formValues}
        eventMode
      />
    </div>
  );
}
