// Pure kammi-booking logic: date math, price, validation and availability.
// No Prisma, no network. The rules that decide a price or reject a date
// range are unit-testable (see __tests__/kammi.test.ts). Dates are handled as
// 'YYYY-MM-DD' strings (lexically comparable, timezone-free) for the half-open
// range [start, end): the guest leaves on `end`, which is free again that day.

const MS_PER_DAY = 86_400_000;

/** A Date (or Prisma @db.Date) to 'YYYY-MM-DD' in UTC. */
export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD' to a UTC-midnight Date, for Prisma @db.Date columns. */
export function parseISODate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

/** Today as 'YYYY-MM-DD' in the given IANA zone (default Europe/Helsinki). */
export function todayISO(timeZone = 'Europe/Helsinki'): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
}

/** 'YYYY-MM-DD' + n days. */
export function addDays(iso: string, n: number): string {
  return toISODate(new Date(parseISODate(iso).getTime() + n * MS_PER_DAY));
}

/** Whole nights between two ISO dates (end − start). Negative if end < start. */
export function nightsBetween(startISO: string, endISO: string): number {
  return Math.round((parseISODate(endISO).getTime() - parseISODate(startISO).getTime()) / MS_PER_DAY);
}

export type KammiTier = 'SCOUT' | 'OTHER';

export type KammiPrices = {
  weekendScoutCents: number;
  weekendOtherCents: number;
  weekdayScoutCents: number;
  weekdayOtherCents: number;
};

/** A night (the night that begins on `iso`) is a weekend night if it starts on
 * a Friday or a Saturday. Thus pe→la and la→su are each one weekend night. */
export function isWeekendNight(iso: string): boolean {
  const dow = parseISODate(iso).getUTCDay();
  return dow === 5 || dow === 6; // Fri or Sat
}

export type KammiPrice = {
  totalCents: number;
  nights: number;
  weekendNights: number;
  weekdayNights: number;
};

/**
 * Price a stay from the published rules. A weekend night (Fri→Sat, Sat→Sun, or
 * both) is charged as ONE flat weekend package regardless of whether one or both
 * halves are taken. Thus pe–la alone and la–su alone each cost the full weekend
 * price, and the two halves can be sold to different parties. Any non-weekend
 * (Sun–Thu) nights are added at the per-night weekday rate. Each in the chosen
 * tier. Long mixed stays still price sensibly; "pidemmät sovitaan erikseen".
 */
export function computeKammiPrice(
  startISO: string,
  endISO: string,
  tier: KammiTier,
  prices: KammiPrices,
): KammiPrice {
  let weekendNights = 0;
  let weekdayNights = 0;
  for (let d = startISO; d < endISO; d = addDays(d, 1)) {
    if (isWeekendNight(d)) weekendNights += 1;
    else weekdayNights += 1;
  }
  const weekendFlat =
    weekendNights > 0 ? (tier === 'SCOUT' ? prices.weekendScoutCents : prices.weekendOtherCents) : 0;
  const weekdayRate = tier === 'SCOUT' ? prices.weekdayScoutCents : prices.weekdayOtherCents;
  return {
    totalCents: weekendFlat + weekdayNights * weekdayRate,
    nights: weekendNights + weekdayNights,
    weekendNights,
    weekdayNights,
  };
}

export type DayStatus = {
  /** A booking ends the morning of this day (previous guest leaving). */
  morningBusy: boolean;
  /** The night that begins this day is booked (no new arrival possible). */
  nightBusy: boolean;
};

/**
 * Per-day occupancy across the busy ranges, for the calendar. A changeover day
 * (morningBusy but not nightBusy, or vice versa) is drawn half-coloured so it
 * reads as "still bookable from here", for example a Saturday whose Friday night is
 * taken but Saturday night is free.
 */
export function dayStatuses(ranges: DateRange[], fromISO: string, toISO: string): Map<string, DayStatus> {
  const map = new Map<string, DayStatus>();
  for (let d = fromISO; d < toISO; d = addDays(d, 1)) map.set(d, { morningBusy: false, nightBusy: false });
  for (const { start, end } of ranges) {
    // Every booked night makes its own evening and the next morning busy, so a
    // multi-night stay fills the days in between completely.
    for (let d = start; d < end; d = addDays(d, 1)) {
      const night = map.get(d);
      if (night) night.nightBusy = true;
      const morning = map.get(addDays(d, 1));
      if (morning) morning.morningBusy = true;
    }
  }
  return map;
}

/**
 * Who holds each occupied night: a 'YYYY-MM-DD' → label map from the labelled
 * ranges, for the "who is who" tooltip shown to logged-in users.
 */
export function labelsByDay(ranges: DateRange[], fromISO: string, toISO: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const { start, end, label } of ranges) {
    if (!label) continue;
    for (let d = start < fromISO ? fromISO : start; d < end && d < toISO; d = addDays(d, 1)) {
      if (!out[d]) out[d] = label;
    }
  }
  return out;
}

/** Half-open overlap: [aStart,aEnd) and [bStart,bEnd) share at least one night. */
export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export type DateRange = { start: string; end: string; label?: string };

/**
 * Every occupied night across the given ranges as a Set of 'YYYY-MM-DD'. A
 * night `d` is occupied when start ≤ d < end. The checkout day is NOT occupied.
 * Used to grey out days in the booking calendar.
 */
export function occupiedNights(ranges: DateRange[]): Set<string> {
  const days = new Set<string>();
  for (const { start, end } of ranges) {
    for (let d = start; d < end; d = addDays(d, 1)) days.add(d);
  }
  return days;
}

export type BookingValidation =
  | { ok: true; nights: number }
  | { ok: false; error: string };

/**
 * Validate a requested range against the settings and today. Does NOT check
 * availability (that needs the DB/calendar). This checks only the shape of the request.
 */
export function validateBookingDates(input: {
  startISO: string;
  endISO: string;
  todayISO: string;
  minNights: number;
  maxNights: number;
}): BookingValidation {
  const { startISO, endISO, todayISO, minNights, maxNights } = input;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startISO) || !/^\d{4}-\d{2}-\d{2}$/.test(endISO)) {
    return { ok: false, error: 'Virheellinen päivämäärä.' };
  }
  if (startISO < todayISO) {
    return { ok: false, error: 'Aloituspäivä ei voi olla menneisyydessä.' };
  }
  const nights = nightsBetween(startISO, endISO);
  if (nights < 1) {
    return { ok: false, error: 'Lähtöpäivän on oltava tulopäivän jälkeen.' };
  }
  if (nights < minNights) {
    return { ok: false, error: `Vähimmäisvaraus on ${minNights} yötä.` };
  }
  if (nights > maxNights) {
    return { ok: false, error: `Enimmäisvaraus on ${maxNights} yötä.` };
  }
  return { ok: true, nights };
}

/**
 * Does the requested range hit any occupied night? Reuses the booked ranges
 * (DB holds/confirmations + calendar busy) that the page already fetched.
 */
export function rangeIsFree(startISO: string, endISO: string, busy: DateRange[]): boolean {
  return !busy.some((b) => rangesOverlap(startISO, endISO, b.start, b.end));
}
