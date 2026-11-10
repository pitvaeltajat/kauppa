import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { ArrowRight, Plus } from 'lucide-react';
import { auth } from '@/lib/auth';
import { getUserRole, isEventAdmin } from '@/lib/admin';
import { ItemCard } from '@/components/item-card';
import { SiteBanner } from '@/components/site-banner';
import { ButtonLink } from '@/components/ui/button-link';
import { listedItemWhere } from '@/lib/catalog';
import { isSystemCategorySlug } from '@/lib/categories';
import { getSiteSettings } from '@/lib/siteSettings';

export default async function HomePage() {
  const session = await auth();
  const role = await getUserRole(session?.user?.email ?? null);
  const eventAdmin = isEventAdmin(role);
  const listed = listedItemWhere();
  const [categories, items, settings] = await Promise.all([
    prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
    prisma.item.findMany({
      where: listed,
      orderBy: [{ featured: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      include: { category: true },
    }),
    getSiteSettings(),
  ]);

  const grouped = [...categories].sort((a, b) => {
    if (a.slug === 'tapahtumat') return -1;
    if (b.slug === 'tapahtumat') return 1;
    return 0;
  }).map((category) => ({
    ...category,
    items: items.filter((item) => item.categoryId === category.id),
  }));

  return (
    <div>
      <SiteBanner imageUrl={settings?.bannerImageUrl} imagePosition={settings?.bannerPosition} />

      <div className="container">
        {/* Featured items */}
        {items.some((item) => item.featured) && (
          <section className="border-t py-8">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {items
                .filter((item) => item.featured)
                .map((item) => <ItemCard key={item.id} item={item} featured />)}
            </div>
          </section>
        )}

        {/* All items, grouped by category */}
        <section className="space-y-10 pb-8">
          {grouped.map((category) => (
            <div key={category.id}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xl font-bold">{category.name}</h2>
                <div className="flex flex-wrap items-center gap-3">
                  {eventAdmin && isSystemCategorySlug(category.slug) && (
                    <ButtonLink href="/admin/events/new" variant="outline" size="sm">
                      <Plus /> Lisää tapahtuma
                    </ButtonLink>
                  )}
                  <Link
                    href={`/category/${category.slug}`}
                    className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    Kaikki tuotteet
                    <ArrowRight className="size-4" />
                  </Link>
                </div>
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
