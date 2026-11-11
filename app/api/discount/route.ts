import { NextResponse } from 'next/server';
import { loadValidDiscount } from '@/lib/discountCodes';

/**
 * Validate a discount code for the cart preview. Returns the code's terms so
 * the cart can show the discounted total before checkout. Checkout re-validates
 * authoritatively - this is UX only.
 */
export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get('code') ?? '';
  const discount = await loadValidDiscount(code);
  if (!discount) {
    return NextResponse.json({ error: 'Alennuskoodi ei kelpaa.' }, { status: 404 });
  }
  return NextResponse.json({ discount });
}
