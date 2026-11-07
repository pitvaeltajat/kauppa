import { describe, expect, it } from 'vitest';
import { renderOrderReceiptEmail, type OrderEmailData } from '@/lib/emails';

const base: OrderEmailData = {
  id: 'clabc12345678',
  name: 'Maija Meikäläinen',
  email: 'maija@example.com',
  totalCents: 3200,
  lines: [
    { name: 'PitVa-huivi', quantity: 2, priceCents: 1600, answers: [{ prompt: 'Koko', answer: 'M' }] },
  ],
};

describe('renderOrderReceiptEmail', () => {
  it('shows the line, the answer and the total, and the short order number', () => {
    const { subject, html } = renderOrderReceiptEmail(base);
    expect(subject).toContain('#12345678'); // last 8 of the id, upper-cased
    expect(html).toContain('PitVa-huivi × 2');
    expect(html).toContain('Koko: M');
    expect(html).toContain('32,00'); // 2 × 16,00 total
  });

  it('escapes HTML in buyer-supplied text so it cannot inject markup', () => {
    const { html } = renderOrderReceiptEmail({
      ...base,
      name: '<script>x</script>',
      lines: [{ name: '<b>bad</b>', quantity: 1, priceCents: 100, answers: [] }],
    });
    expect(html).not.toContain('<script>x</script>');
    expect(html).not.toContain('<b>bad</b>');
    expect(html).toContain('&lt;b&gt;bad&lt;/b&gt;');
  });
});
