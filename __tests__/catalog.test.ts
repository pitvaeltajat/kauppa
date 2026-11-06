import { describe, expect, it } from 'vitest';
import { listedItemWhere, isEventOver, formatEventDates } from '@/lib/catalog';

const NOW = new Date('2026-11-06T12:00:00Z');

describe('isEventOver', () => {
  it('is false for a future or undated event', () => {
    expect(isEventOver(null, NOW)).toBe(false);
    expect(isEventOver(new Date('2026-11-20'), NOW)).toBe(false);
  });
  it('is false within the one-week grace after it ends', () => {
    expect(isEventOver(new Date('2026-11-01'), NOW)).toBe(false); // 5 days ago
  });
  it('is true once more than a week has passed', () => {
    expect(isEventOver(new Date('2026-10-28'), NOW)).toBe(true); // 9 days ago
  });
});

describe('listedItemWhere', () => {
  it('lists active, non-hidden items and events ended < 1 week ago', () => {
    const where = listedItemWhere(NOW);
    expect(where.active).toBe(true);
    expect(where.hidden).toBe(false);
    // cutoff = now - 7d; events with endsAt >= cutoff (or null) stay listed.
    const cutoff = (where.OR as { endsAt?: { gte?: Date } }[])[1].endsAt!.gte!;
    expect(cutoff.getTime()).toBe(NOW.getTime() - 7 * 24 * 60 * 60 * 1000);
  });
});

describe('formatEventDates', () => {
  it('shows a single day when start equals end', () => {
    expect(formatEventDates(new Date('2026-11-14'), new Date('2026-11-14'))).toBe('14.11.2026');
  });
  it('shows a range across two days', () => {
    expect(formatEventDates(new Date('2026-11-14'), new Date('2026-11-15'))).toBe(
      '14.11.2026 – 15.11.2026',
    );
  });
  it('is empty without dates', () => {
    expect(formatEventDates(null, null)).toBe('');
  });
});
