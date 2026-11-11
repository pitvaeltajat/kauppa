import type { KammiBooking, KammiSettings } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  parseISODate,
  toISODate,
  todayISO,
  addDays,
  validateBookingDates,
  computeKammiPrice,
  rangeIsFree,
  type DateRange,
  type KammiTier,
} from '@/lib/kammi';
import { fetchKammiBusyRanges, createKammiEvent, deleteKammiEvent } from '@/lib/googleCalendar';

/** How long a Stripe checkout hold keeps the dates reserved before it lapses. */
const HOLD_MINUTES = 20;

export const KAMMI_ACCOUNTING_CLASS_ID = 'income-3500';
export const KAMMI_ACCOUNTING_CLASS_NAME = '3500 — Kammin vuokratuotot';

/** Keep the fixed Kammi accounting class available in every environment. */
export async function ensureKammiAccountingClass(): Promise<string> {
  await prisma.accountingClass.upsert({
    where: { id: KAMMI_ACCOUNTING_CLASS_ID },
    update: { name: KAMMI_ACCOUNTING_CLASS_NAME, sortOrder: 50 },
    create: { id: KAMMI_ACCOUNTING_CLASS_ID, name: KAMMI_ACCOUNTING_CLASS_NAME, sortOrder: 50 },
  });
  return KAMMI_ACCOUNTING_CLASS_ID;
}

/** The single settings row, created on first read. */
export async function getKammiSettings(): Promise<KammiSettings> {
  await ensureKammiAccountingClass();
  return prisma.kammiSettings.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton', accountingClassId: KAMMI_ACCOUNTING_CLASS_ID },
  });
}

/** Lapse PENDING holds whose window has passed, so their dates free up. */
export async function expireStaleHolds(): Promise<void> {
  await prisma.kammiBooking.updateMany({
    where: { status: 'PENDING', holdExpiresAt: { lt: new Date() } },
    data: { status: 'CANCELLED' },
  });
}

/** A booking's date range as ISO strings, labelled with who booked it. */
function bookingRange(
  b: Pick<KammiBooking, 'startDate' | 'endDate' | 'name' | 'organization'>,
): DateRange {
  return {
    start: toISODate(b.startDate),
    end: toISODate(b.endDate),
    label: b.organization || b.name || 'Varaus',
  };
}

/**
 * Every range that is NOT available in [fromISO, toISO): kontti's own live
 * bookings (CONFIRMED + unexpired PENDING) plus whatever the Google calendar
 * marks busy. Stale holds are lapsed first so they don't linger.
 */
export async function getBusyRanges(fromISO: string, toISO: string): Promise<DateRange[]> {
  await expireStaleHolds();
  const [dbBookings, calendar] = await Promise.all([
    prisma.kammiBooking.findMany({
      where: {
        status: { in: ['PENDING', 'CONFIRMED'] },
        endDate: { gt: parseISODate(fromISO) },
        startDate: { lt: parseISODate(toISO) },
      },
      select: { startDate: true, endDate: true, name: true, organization: true },
    }),
    fetchKammiBusyRanges(fromISO, toISO),
  ]);
  return [...dbBookings.map(bookingRange), ...calendar];
}

export type CreateHoldInput = {
  startISO: string;
  endISO: string;
  tier: KammiTier;
  email: string | null;
  name: string | null;
  phone: string | null;
  organization: string | null;
  eventInfo: string | null;
  hostQuestions: string | null;
  billingEmail: string | null;
  requestKey?: string | null;
};

export type CreateHoldResult = { ok: true; booking: KammiBooking } | { ok: false; error: string };

/**
 * Validate and reserve a stay. The database exclusion constraint is the
 * race-proof guarantee; the pre-check gives a friendly error for the common
 * case and avoids creating a doomed Stripe session.
 *
 * With `free`, the booking is created already CONFIRMED at price 0 and written
 * to the calendar — used for a logged-in pitva member's scout booking, which
 * skips payment. The caller must have verified that eligibility server-side.
 */
export async function createKammiHold(
  input: CreateHoldInput,
  { free = false, holdMinutes = HOLD_MINUTES }: { free?: boolean; holdMinutes?: number } = {},
): Promise<CreateHoldResult> {
  const settings = await getKammiSettings();
  if (!settings.active)
    return { ok: false, error: 'Kammin verkkovaraus ei ole tällä hetkellä käytössä.' };

  const validation = validateBookingDates({
    startISO: input.startISO,
    endISO: input.endISO,
    todayISO: todayISO(),
    minNights: settings.minNights,
    maxNights: settings.maxNights,
  });
  if (!validation.ok) return { ok: false, error: validation.error };

  const busy = await getBusyRanges(input.startISO, input.endISO);
  if (!rangeIsFree(input.startISO, input.endISO, busy)) {
    return { ok: false, error: 'Valitut päivät ovat jo varattuja. Valitse toiset päivät.' };
  }

  const price = computeKammiPrice(input.startISO, input.endISO, input.tier, settings);

  try {
    const accountingClassId = settings.accountingClassId;
    const booking = await prisma.kammiBooking.create({
      data: {
        startDate: parseISODate(input.startISO),
        endDate: parseISODate(input.endISO),
        nights: validation.nights,
        tier: input.tier,
        status: free ? 'CONFIRMED' : 'PENDING',
        email: input.email,
        name: input.name,
        phone: input.phone,
        organization: input.organization,
        eventInfo: input.eventInfo,
        hostQuestions: input.hostQuestions,
        billingEmail: input.billingEmail,
        requestKey: input.requestKey ?? undefined,
        totalCents: free ? 0 : price.totalCents,
        holdExpiresAt: free ? null : new Date(Date.now() + holdMinutes * 60_000),
        paidAt: free ? new Date() : null,
        accountingClassId,
      },
    });
    if (free) {
      // No webhook will fire, so write the calendar entry here (best-effort).
      const eventId = await createKammiEvent({
        summary: `Kammi varattu — ${booking.name ?? booking.email ?? 'varaus'}`,
        description: `Partiovaraus (maksuton) kauppa.pitva.fi:n kautta.${booking.email ? ` ${booking.email}` : ''}`,
        startISO: toISODate(booking.startDate),
        endISO: toISODate(booking.endDate),
      });
      if (eventId) {
        return {
          ok: true,
          booking: await prisma.kammiBooking.update({
            where: { id: booking.id },
            data: { googleEventId: eventId },
          }),
        };
      }
    }
    return { ok: true, booking };
  } catch (error) {
    // The exclusion constraint fired. Someone else took these dates in the gap
    // between the pre-check and the insert.
    if (error instanceof Error && error.message.includes('KammiBooking_no_overlap')) {
      return { ok: false, error: 'Joku ehti varata valitut päivät. Valitse toiset päivät.' };
    }
    throw error;
  }
}

/**
 * Mark a hold paid. Returns true only on the real PENDING→CONFIRMED transition
 * (so a duplicate webhook doesn't re-send mail), after which it writes the
 * booking to the Google calendar. Idempotent.
 */
export async function confirmKammiBooking(
  bookingId: string,
  stripeSessionId: string | null,
): Promise<boolean> {
  const booking = await prisma.kammiBooking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.status === 'CONFIRMED') return false;

  await prisma.kammiBooking.update({
    where: { id: bookingId },
    data: {
      status: 'CONFIRMED',
      paidAt: new Date(),
      holdExpiresAt: null,
      stripeSessionId: stripeSessionId ?? booking.stripeSessionId,
    },
  });

  const eventId = await createKammiEvent({
    summary: `Kammi varattu: ${booking.name ?? booking.email ?? 'varaus'}`,
    description: `Varaus kontti.pitva.fi:n kautta.${booking.email ? ` ${booking.email}` : ''}`,
    startISO: toISODate(booking.startDate),
    endISO: toISODate(booking.endDate),
  });
  if (eventId) {
    await prisma.kammiBooking.update({
      where: { id: bookingId },
      data: { googleEventId: eventId },
    });
  }
  return true;
}

/** Cancel a booking and remove its calendar event, freeing the dates. */
export async function cancelKammiBooking(bookingId: string): Promise<void> {
  const booking = await prisma.kammiBooking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.status === 'CANCELLED') return;
  await prisma.kammiBooking.update({ where: { id: bookingId }, data: { status: 'CANCELLED' } });
  if (booking.googleEventId) await deleteKammiEvent(booking.googleEventId);
}

/** The window the public booking calendar shows: today → `months` ahead. */
export function bookingWindow(months = 6): { fromISO: string; toISO: string } {
  const fromISO = todayISO();
  return { fromISO, toISO: addDays(fromISO, months * 31) };
}
