import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { deleteCategory } from '@/lib/actions/admin';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Kategoriat' };

export default async function AdminCategoriesPage() {
  const categories = await prisma.category.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { items: true } } },
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Kategoriat ({categories.length})</h1>
        <Link href="/admin/categories/new">
          <Button variant="cta">
            <Plus /> Uusi kategoria
          </Button>
        </Link>
      </div>

      <div className="space-y-3">
        {categories.length === 0 && (
          <p className="rounded-lg border border-dashed bg-card px-4 py-10 text-center text-sm text-muted-foreground">
            Ei kategorioita. Luo ensimmäinen!
          </p>
        )}
        {categories.map((category) => (
          <div
            key={category.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4 shadow-sm"
          >
            <div>
              <p className="font-semibold">
                {category.name}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  /{category.slug} · {category.sortOrder}
                </span>
              </p>
              {category.description && (
                <p className="mt-0.5 text-sm text-muted-foreground">{category.description}</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                {category._count.items} tuotetta
              </p>
            </div>
            <div className="flex gap-2">
              <Link href={`/admin/categories/${category.id}`}>
                <Button type="button" size="sm" variant="outline">
                  Muokkaa
                </Button>
              </Link>
              <form action={deleteCategory}>
                <input type="hidden" name="id" value={category.id} />
                <Button
                  type="submit"
                  size="sm"
                  variant="ghost"
                  disabled={category._count.items > 0}
                  title={
                    category._count.items > 0
                      ? 'Kategoriassa on tuotteita — siirrä tai piilota ne ensin'
                      : 'Poista kategoria'
                  }
                >
                  Poista
                </Button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
