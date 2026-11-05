import { describe, expect, it } from 'vitest';
import { slugify } from '@/lib/slug';

describe('slugify', () => {
  it('lowercases and strips diacritics', () => {
    expect(slugify('PitVa-huivi')).toBe('pitva-huivi');
    expect(slugify('Pitkäjärven Vaeltajat')).toBe('pitkajarven-vaeltajat');
    expect(slugify('Päiväretki Ömerkurssille')).toBe('paivaretki-omerkurssille');
  });
  it('collapses runs of separators', () => {
    expect(slugify('Sudenpentuosaston  retki 28.-29.11.2026')).toBe(
      'sudenpentuosaston-retki-28-29-11-2026',
    );
  });
  it('trims leading/trailing dashes', () => {
    expect(slugify(' -huppari- ')).toBe('huppari');
  });
  it('falls back when nothing remains', () => {
    expect(slugify('?????')).toBe('tuote');
  });
});
