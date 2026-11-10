import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStripe } from '@/lib/stripe';
import { toISODate } from '@/lib/kammi';

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let payload: { email?: unknown } = {};
  try { payload = (await req.json()) as { email?: unknown }; } catch {}
  const payerEmail = typeof payload.email === 'string' && payload.email.includes('@') ? payload.email.trim().slice(0, 254) : null;
  const booking = await prisma.kammiBooking.findUnique({ where: { paymentToken: token } });
  if (!booking) return NextResponse.json({ error: 'Maksulinkkiä ei löydy.' }, { status: 404 });
  if (booking.status !== 'PENDING') {
    return NextResponse.json({ error: 'Varaus ei ole enää maksettavissa.' }, { status: 400 });
  }
  const stripe = getStripe();
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? req.headers.get('origin') ?? '').replace(/\/$/, '');
  if (!appUrl) return NextResponse.json({ error: 'Maksupalvelu ei ole konfiguroitu.' }, { status: 500 });
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ quantity: 1, price_data: { currency: 'eur', unit_amount: booking.totalCents, product_data: { name: `Kammi ${toISODate(booking.startDate)} – ${toISODate(booking.endDate)}` } } }],
    customer_email: payerEmail ?? undefined,
    metadata: { kammiBookingId: booking.id },
    success_url: `${appUrl}/kammi/kiitos`,
    cancel_url: `${appUrl}/kammi/pay/${encodeURIComponent(token)}`,
    locale: 'fi',
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
  });
  await prisma.kammiBooking.update({ where: { id: booking.id }, data: { stripeSessionId: session.id, billingEmail: payerEmail ?? undefined } });
  return NextResponse.json({ url: session.url });
}
