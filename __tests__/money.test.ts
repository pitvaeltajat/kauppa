import { describe, expect, it } from 'vitest';
import { formatCents, parseEurosInput } from '@/lib/money';

// Intl inserts a no-break space between the amount and the currency sign.
const NBSP = '\u00A0';

describe('formatCents', () => {
  it('formats whole euros with the Finnish comma', () => {
    expect(formatCents(1600)).toBe(`16,00${NBSP}€`);
  });
  it('formats small amounts', () => {
    expect(formatCents(7)).toBe(`0,07${NBSP}€`);
    expect(formatCents(0)).toBe(`0,00${NBSP}€`);
  });
  it('formats cents correctly', () => {
    expect(formatCents(1234)).toBe(`12,34${NBSP}€`);
  });
});

describe('parseEurosInput', () => {
  it('accepts a Finnish decimal comma', () => {
    expect(parseEurosInput('16,00')).toBe(1600);
    expect(parseEurosInput('12,34')).toBe(1234);
  });
  it('accepts a dot decimal', () => {
    expect(parseEurosInput('16.00')).toBe(1600);
    expect(parseEurosInput('12.5')).toBe(1250);
  });
  it('tolerates the euro sign and spaces', () => {
    expect(parseEurosInput(' 16 € ')).toBe(1600);
    expect(parseEurosInput('8,50€')).toBe(850);
  });
  it('rejects garbage and negative values', () => {
    expect(parseEurosInput('abc')).toBeNull();
    expect(parseEurosInput('')).toBeNull();
    expect(parseEurosInput('-5')).toBeNull();
  });
});
