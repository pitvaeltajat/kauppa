import { prisma } from '@/lib/prisma';
import { getUserRole, isEventAdmin, isSuperAdmin } from '@/lib/admin';
import { getSession } from '@/lib/session';
import { ItemCard } from '@/components/item-card';
import { SiteBanner } from '@/components/site-banner';
import { listedItemWhere, lowestVariantPrice } from '@/lib/catalog';
import { getSiteSettings } from '@/lib/siteSettings';
import { HomepageOrganizer } from '@/components/admin/homepage-organizer';

export default async function HomePage() {
  const session = await getSession();
  const role = await getUserRole(session?.user?.email ?? null);
  const eventAdmin = isEventAdmin(role);
  const canReorderProducts = isSuperAdmin(role);
  const listed = listedItemWhere();
  const [categories, items, settings] = await Promise.all([
    prisma.category.findMany({
      select: { id: true, name: true, slug: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
    prisma.item.findMany({
      where: listed,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        categoryId: true,
        name: true,
        slug: true,
        imageUrl: true,
        stock: true,
        description: true,
        isEvent: true,
        startsAt: true,
        endsAt: true,
        featured: true,
        featuredOrder: true,
        variants: { where: { active: true }, select: { priceCents: true } },
      },
    }),
    getSiteSettings(),
  ]);

  const catalogItems = items.map((item) => ({
    ...item,
    priceCents: lowestVariantPrice(item.variants),
  }));

  const grouped = [...categories]
    .sort((a, b) => {
      if (a.slug === 'tapahtumat') return -1;
      if (b.slug === 'tapahtumat') return 1;
      return 0;
    })
    .map((category) => ({
      ...category,
      items: catalogItems.filter((item) => item.categoryId === category.id),
    }));

  return (
    <div>
      <SiteBanner imageUrl={settings?.bannerImageUrl} imagePosition={settings?.bannerPosition} />

      <div className="container">
        {eventAdmin ? (
          <HomepageOrganizer categories={grouped} canReorderProducts={canReorderProducts} />
        ) : (
          <>
            {catalogItems.some((item) => item.featured) && (
              <section className="border-t py-8">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {catalogItems
                    .filter((item) => item.featured)
                    .sort((a, b) => a.featuredOrder - b.featuredOrder)
                    .map((item) => (
                      <ItemCard key={item.id} item={item} featured />
                    ))}
                </div>
              </section>
            )}
            <section className="space-y-10 pb-8">
              {grouped.map((category) => (
                <div key={category.id}>
                  <h2 className="mb-4 text-xl font-bold">{category.name}</h2>
                  <div
                    className={
                      category.slug === 'tapahtumat'
                        ? 'grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4'
                        : 'grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4'
                    }
                  >
                    {category.items.map((item) => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        listOnMobile={category.slug === 'tapahtumat'}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
