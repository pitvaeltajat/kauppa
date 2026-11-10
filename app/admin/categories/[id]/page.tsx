import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { CategoryForm } from '@/components/admin/category-form';
import { isSystemCategorySlug } from '@/lib/categories';

export const metadata: Metadata = { title: 'Muokkaa kategoriaa' };

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) notFound();

  return (
    <div>
      <Link
        href="/admin/categories"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> Kategoriat
      </Link>
      <h1 className="mb-6 text-2xl font-bold">Muokkaa kategoriaa</h1>
      {isSystemCategorySlug(category.slug) ? (
        <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          Tapahtumat on järjestelmäkategoria, eikä sitä voi muuttaa.
        </p>
      ) : (
        <CategoryForm category={category} />
      )}
    </div>
  );
}
