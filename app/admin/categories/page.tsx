import type { Metadata } from 'next';
import { Plus } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { deleteCategory } from '@/lib/actions/admin';
import { requireSuperAdmin } from '@/lib/admin-guard';
import { ButtonLink } from '@/components/ui/button-link';
import { FormButton } from '@/components/admin/form-button';
import { isSystemCategorySlug } from '@/lib/categories';

export const metadata: Metadata = { title: 'Kategoriat' };

export default async function AdminCategoriesPage() {
  await requireSuperAdmin();
  const categories = await prisma.category.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { items: true } } },
  });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Kategoriat ({categories.length})</h1>
        <ButtonLink href="/admin/categories/new" variant="cta">
          <Plus /> Uusi kategoria
        </ButtonLink>
      </div>

      <div className="space-y-3">
        {categories.length === 0 && (
          <p className="rounded-lg border border-dashed bg-card px-4 py-10 text-center text-sm text-muted-foreground">
            Kategorioita ei ole vielä. Luo ensimmäinen kategoria.
          </p>
        )}
        {categories.map((category) =>
          (() => {
            const systemCategory = isSystemCategorySlug(category.slug);
            return (
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
                  {systemCategory && (
                    <p className="mt-1 text-xs font-medium text-muted-foreground">
                      Järjestelmäkategoria
                    </p>
                  )}
                  {category.description && (
                    <p className="mt-0.5 text-sm text-muted-foreground">{category.description}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {category._count.items} tuotetta
                  </p>
                </div>
                <div className="flex gap-2">
                  {!systemCategory && (
                    <ButtonLink
                      href={`/admin/categories/${category.id}`}
                      size="sm"
                      variant="outline"
                    >
                      Muokkaa
                    </ButtonLink>
                  )}
                  <form action={deleteCategory}>
                    <input type="hidden" name="id" value={category.id} />
                    <FormButton
                      size="sm"
                      variant="ghost"
                      disabled={systemCategory || category._count.items > 0}
                      confirm={`Poista kategoria "${category.name}"? Tätä ei voi perua.`}
                      title={
                        systemCategory
                          ? 'Järjestelmäkategoriaa ei voi poistaa.'
                          : category._count.items > 0
                            ? 'Kategoriassa on tuotteita. Siirrä tai piilota ne ensin.'
                            : 'Poista kategoria'
                      }
                    >
                      Poista
                    </FormButton>
                  </form>
                </div>
              </div>
            );
          })(),
        )}
      </div>
    </div>
  );
}
