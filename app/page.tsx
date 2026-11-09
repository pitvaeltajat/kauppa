import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { ArrowRight, Plus } from 'lucide-react';
import { auth } from '@/lib/auth';
import { getUserRole, isSuperAdmin } from '@/lib/admin';
import { CategoryTile } from '@/components/category-tile';
import { ItemCard } from '@/components/item-card';
import { SiteBanner } from '@/components/site-banner';
import { ButtonLink } from '@/components/ui/button-link';
import { listedItemWhere } from '@/lib/catalog';
import { getSiteSettings } from '@/lib/siteSettings';

export default async function HomePage() {
  const session = await auth();
  const superAdmin = isSuperAdmin(await getUserRole(session?.user?.email ?? null));
  const listed = listedItemWhere();
  const settings = await getSiteSettings();
  const [categories, items] = await Promise.all([
    prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { items: { where: listed } } },
        items: {
          where: listed,
          orderBy: [{ featured: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
          take: 3,
        },
      },
    }),
    prisma.item.findMany({
      where: listed,
      orderBy: [{ featured: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      include: { category: true },
    }),
  ]);

  const grouped = categories.map((category) => ({
    ...category,
    previewItems: category.items,
    items: items.filter((item) => item.categoryId === category.id),
  }));

  return (
    <div>
      <SiteBanner imageUrl={settings?.bannerImageUrl} />

      <div className="container">
        {/* Admin shortcuts. Only superadmins see this. */}
        {superAdmin && (
          <div className="flex flex-wrap gap-2 pt-6">
            <ButtonLink href="/admin/items/new" variant="cta" size="sm">
              <Plus /> Lisää tuote
            </ButtonLink>
            <ButtonLink href="/admin/categories/new" variant="outline" size="sm">
              <Plus /> Lisää kategoria
            </ButtonLink>
          </div>
        )}

        {/* Category tiles */}
        <section className="grid gap-4 py-8 sm:grid-cols-2 lg:grid-cols-3">
          {grouped.map((category) => (
            <CategoryTile
              key={category.id}
              category={{
                id: category.id,
                name: category.name,
                slug: category.slug,
                description: category.description,
                itemCount: category._count.items,
                previewItems: category.previewItems,
              }}
            />
          ))}
        </section>

        {/* Featured items */}
        {items.some((item) => item.featured) && (
          <section className="border-t py-8">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl font-bold">Nostot</h2>
              <span className="text-sm text-muted-foreground">Poimintoja tuotteista</span>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {items
                .filter((item) => item.featured)
                .map((item) => (
                  <ItemCard key={item.id} item={item} />
                ))}
            </div>
          </section>
        )}

        {/* All items, grouped by category */}
        <section className="space-y-10 pb-8">
          {grouped.map((category) => (
            <div key={category.id}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xl font-bold">{category.name}</h2>
                <Link
                  href={`/category/${category.slug}`}
                  className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  Kaikki tuotteet
                  <ArrowRight className="size-4" />
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {category.items.map((item) => (
                  <ItemCard key={item.id} item={item} />
                ))}
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
