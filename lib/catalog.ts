import type { Prisma } from '@prisma/client';
import { format } from 'date-fns';
import { fi } from 'date-fns/locale';

/** How long an event stays listed after it ends, before auto-hiding. */
const EVENT_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Where-filter for items the public shop lists (front page, category pages,
 * header). An item shows when it is active, not manually hidden, and, if it is
 * an event, ended less than a week ago. Items excluded here are still reachable
 * and buyable at their direct /item/<slug> link; only the listings drop them.
 */
export function listedItemWhere(now: Date = new Date()): Prisma.ItemWhereInput {
  const cutoff = new Date(now.getTime() - EVENT_GRACE_MS);
  return {
    active: true,
    hidden: false,
    OR: [{ endsAt: null }, { endsAt: { gte: cutoff } }],
  };
}

/** True once an event ended more than a week ago (auto-hidden from listings). */
export function isEventOver(endsAt: Date | null | undefined, now: Date = new Date()): boolean {
  return endsAt != null && endsAt.getTime() < now.getTime() - EVENT_GRACE_MS;
}

/** "28.11.2026" or "28.11.2026 – 29.11.2026" for display; empty without dates. */
export function formatEventDates(
  startsAt: Date | null | undefined,
  endsAt: Date | null | undefined,
): string {
  const fmt = (d: Date) => format(d, 'd.M.yyyy', { locale: fi });
  if (startsAt && endsAt) {
    return startsAt.getTime() === endsAt.getTime() ? fmt(startsAt) : `${fmt(startsAt)} – ${fmt(endsAt)}`;
  }
  if (startsAt) return fmt(startsAt);
  if (endsAt) return fmt(endsAt);
  return '';
}
