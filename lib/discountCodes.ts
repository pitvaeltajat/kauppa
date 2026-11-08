import { prisma } from '@/lib/prisma';
import { type DiscountCodeLike, normalizeCode } from '@/lib/discount';

/**
 * Look up a code the buyer typed and return it only if it is usable right now
 * (exists, active, not past its expiry). Server-only — the DB is the source of
 * truth; the cart's client-side preview is just UX.
 */
export async function loadValidDiscount(raw: string | null | undefined): Promise<DiscountCodeLike | null> {
  const code = normalizeCode(raw ?? '');
  if (!code) return null;
  const row = await prisma.discountCode.findUnique({ where: { code } });
  if (!row || !row.active) return null;
  if (row.validUntil && row.validUntil.getTime() < Date.now()) return null;
  return { code: row.code, percentOff: row.percentOff, leaderOnly: row.leaderOnly };
}
