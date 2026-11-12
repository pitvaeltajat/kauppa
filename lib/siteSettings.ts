import { prisma } from '@/lib/prisma';

/** The shop-wide settings row, or null if it has never been saved. Read-only
 * (no upsert) so the public front page doesn't write on every view. */
export async function getSiteSettings() {
  return prisma.siteSettings.findUnique({
    where: { id: 'singleton' },
    select: { bannerImageUrl: true, bannerPosition: true },
  });
}
