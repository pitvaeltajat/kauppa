import { prisma } from '@/lib/prisma';
import type { SiteSettings } from '@prisma/client';

/** The shop-wide settings row, or null if it has never been saved. Read-only
 * (no upsert) so the public front page doesn't write on every view. */
export async function getSiteSettings(): Promise<SiteSettings | null> {
  return prisma.siteSettings.findUnique({ where: { id: 'singleton' } });
}
