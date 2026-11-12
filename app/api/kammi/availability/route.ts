import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getUserRole, isSuperAdmin } from '@/lib/admin';
import { getBusyRanges } from '@/lib/kammiBookings';
import { bookingIdsByDay, dayStatuses, labelsByDay, nightsBetween } from '@/lib/kammi';

export const dynamic = 'force-dynamic';

/**
 * Busy days for a date window, so the booking calendar can load further months
 * on demand. Labels (who holds a night) are returned only to logged-in viewers,
 * same as the page's initial render.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (!iso.test(from) || !iso.test(to) || from >= to) {
    return NextResponse.json({ error: 'Virheellinen aikaväli.' }, { status: 400 });
  }
  // Cap the span so one request can't scan an unbounded range.
  if (nightsBetween(from, to) > 400) {
    return NextResponse.json({ error: 'Liian pitkä aikaväli.' }, { status: 400 });
  }

  const busy = await getBusyRanges(from, to);
  const statuses: Record<string, { m: boolean; n: boolean }> = {};
  for (const [day, s] of dayStatuses(busy, from, to))
    statuses[day] = { m: s.morningBusy, n: s.nightBusy };

  const session = await auth();
  const labels = session?.user?.email ? labelsByDay(busy, from, to) : {};
  const role = await getUserRole(session?.user?.email ?? null);
  const bookingIds = isSuperAdmin(role) ? bookingIdsByDay(busy, from, to) : {};

  return NextResponse.json({ statuses, labels, bookingIds });
}
