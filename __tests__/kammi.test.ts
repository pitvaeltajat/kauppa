import { describe, expect, it } from 'vitest';
import {
  nightsBetween,
  addDays,
  rangesOverlap,
  occupiedNights,
  isWeekendNight,
  computeKammiPrice,
  dayStatuses,
  validateBookingDates,
  rangeIsFree,
  type KammiPrices,
} from '@/lib/kammi';
import { eventToRange } from '@/lib/googleCalendar';

const prices: KammiPrices = {
  weekendScoutCents: 20000,
  weekendOtherCents: 30000,
  weekdayScoutCents: 5000,
  weekdayOtherCents: 10000,
};

describe('date math', () => {
  it('counts nights and adds days across a month boundary', () => {
    expect(nightsBetween('2026-12-20', '2026-12-23')).toBe(3);
    expect(nightsBetween('2026-01-31', '2026-02-02')).toBe(2);
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01'); // 2026 not a leap year
  });
});

describe('overlap (half-open)', () => {
  it('overlaps when they share a night, not when merely adjacent', () => {
    expect(rangesOverlap('2026-12-20', '2026-12-23', '2026-12-22', '2026-12-25')).toBe(true);
    expect(rangesOverlap('2026-12-20', '2026-12-23', '2026-12-23', '2026-12-25')).toBe(false);
  });
  it('occupiedNights excludes the checkout day', () => {
    const nights = occupiedNights([{ start: '2026-12-20', end: '2026-12-23' }]);
    expect([...nights].sort()).toEqual(['2026-12-20', '2026-12-21', '2026-12-22']);
  });
  it('rangeIsFree rejects an overlapping request', () => {
    const busy = [{ start: '2026-12-20', end: '2026-12-23' }];
    expect(rangeIsFree('2026-12-23', '2026-12-25', busy)).toBe(true);
    expect(rangeIsFree('2026-12-22', '2026-12-24', busy)).toBe(false);
  });
});

describe('pricing', () => {
  // 2027-01-29 Fri, -30 Sat, -31 Sun, 2027-02-01 Mon.
  it('flags Friday and Saturday nights as weekend nights', () => {
    expect(isWeekendNight('2027-01-29')).toBe(true); // Fri night
    expect(isWeekendNight('2027-01-30')).toBe(true); // Sat night
    expect(isWeekendNight('2027-01-31')).toBe(false); // Sun night
    expect(isWeekendNight('2027-02-01')).toBe(false); // Mon night
  });
  it('charges pe–la, la–su and the whole weekend the same flat weekend price', () => {
    expect(computeKammiPrice('2027-01-29', '2027-01-30', 'SCOUT', prices).totalCents).toBe(20000); // Fri→Sat
    expect(computeKammiPrice('2027-01-30', '2027-01-31', 'SCOUT', prices).totalCents).toBe(20000); // Sat→Sun
    expect(computeKammiPrice('2027-01-29', '2027-01-31', 'SCOUT', prices).totalCents).toBe(20000); // Fri→Sun, still flat
    expect(computeKammiPrice('2027-01-29', '2027-01-30', 'OTHER', prices).totalCents).toBe(30000);
  });
  it('prices weekday nights per night, and mixes weekend + weekday', () => {
    expect(computeKammiPrice('2027-02-01', '2027-02-04', 'SCOUT', prices).totalCents).toBe(15000); // Mon,Tue,Wed
    // Fri→Mon = Fri+Sat (weekend flat) + Sun night (1 weekday).
    const mixed = computeKammiPrice('2027-01-29', '2027-02-01', 'SCOUT', prices);
    expect(mixed.weekendNights).toBe(2);
    expect(mixed.weekdayNights).toBe(1);
    expect(mixed.totalCents).toBe(25000);
  });
});

describe('eventToRange (Google calendar → booking range)', () => {
  // Dec 2026: 11 Fri, 12 Sat, 13 Sun, 14 Mon.
  it('treats an all-day block\'s last day as checkout, not a night', () => {
    // Fri–Sun block is stored end=Mon (exclusive): leave Sunday, Monday free.
    expect(eventToRange({ start: { date: '2026-12-11' }, end: { date: '2026-12-14' }, summary: 'Helsingin Siniset' })).toEqual({
      start: '2026-12-11',
      end: '2026-12-13',
      label: 'Helsingin Siniset',
    });
    // Sat–Sun block (end=Mon): 1 night Sat, checkout Sunday.
    expect(eventToRange({ start: { date: '2026-12-12' }, end: { date: '2026-12-14' } })).toMatchObject({
      start: '2026-12-12',
      end: '2026-12-13',
    });
  });
  it('keeps a single-day all-day block as one night', () => {
    expect(eventToRange({ start: { date: '2026-11-02' }, end: { date: '2026-11-03' } })).toMatchObject({
      start: '2026-11-02',
      end: '2026-11-03',
    });
  });
  it('uses a timed event\'s end as-is (already the checkout day)', () => {
    expect(
      eventToRange({ start: { dateTime: '2026-12-11T16:00:00+02:00' }, end: { dateTime: '2026-12-13T18:00:00+02:00' } }),
    ).toMatchObject({ start: '2026-12-11', end: '2026-12-13' });
  });
  it('skips cancelled events', () => {
    expect(eventToRange({ status: 'cancelled', start: { date: '2026-12-11' }, end: { date: '2026-12-14' } })).toBeNull();
  });
});

describe('dayStatuses (half-coloured changeover days)', () => {
  it('marks the arrival-night day as night-busy and the checkout day as morning-busy', () => {
    const map = dayStatuses([{ start: '2027-01-29', end: '2027-01-30' }], '2027-01-29', '2027-02-01');
    expect(map.get('2027-01-29')).toEqual({ morningBusy: false, nightBusy: true }); // Fri night booked
    expect(map.get('2027-01-30')).toEqual({ morningBusy: true, nightBusy: false }); // Sat changeover: bookable
  });
});

describe('validateBookingDates', () => {
  const base = { todayISO: '2026-11-07', minNights: 1, maxNights: 14 };
  it('accepts a valid future range', () => {
    expect(validateBookingDates({ ...base, startISO: '2026-12-20', endISO: '2026-12-23' })).toEqual({
      ok: true,
      nights: 3,
    });
  });
  it('rejects the past, zero nights, and over-long stays', () => {
    expect(validateBookingDates({ ...base, startISO: '2026-11-01', endISO: '2026-11-03' }).ok).toBe(false);
    expect(validateBookingDates({ ...base, startISO: '2026-12-20', endISO: '2026-12-20' }).ok).toBe(false);
    expect(validateBookingDates({ ...base, startISO: '2026-12-01', endISO: '2026-12-20' }).ok).toBe(false);
  });
});
