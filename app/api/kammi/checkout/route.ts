import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStripe } from '@/lib/stripe';
import { createKammiHold } from '@/lib/kammiBookings';
import { toISODate, type KammiTier } from '@/lib/kammi';

/**
 * Reserve a kammi hold for the chosen dates and open a Stripe Checkout Session.
 * The webhook (metadata.kammiBookingId) confirms the booking and sends the
 * keycode on payment. Needs STRIPE_SECRET_KEY.
 */
export async function POST(req: Request) {
  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Virheellinen pyyntö.' }, { status: 400 });
  }

  const str = (v: unknown, max: number): string | null =>
    typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;

  const startISO = typeof payload.startDate === 'string' ? payload.startDate : '';
  const endISO = typeof payload.endDate === 'string' ? payload.endDate : '';
  const tier: KammiTier = payload.tier === 'SCOUT' ? 'SCOUT' : 'OTHER';
  const email =
    typeof payload.email === 'string' && payload.email.includes('@')
      ? payload.email.trim().slice(0, 254)
      : null;
  const name = str(payload.name, 200);
  const phone = str(payload.phone, 60);
  const organization = str(payload.organization, 200);
  const eventInfo = str(payload.eventInfo, 2000);
  const hostQuestions = str(payload.hostQuestions, 2000);
  const billingEmail =
    typeof payload.billingEmail === 'string' && payload.billingEmail.includes('@')
      ? payload.billingEmail.trim().slice(0, 254)
      : null;

  if (!email) return NextResponse.json({ error: 'Anna sähköposti kuittia varten.' }, { status: 400 });
  if (!name) return NextResponse.json({ error: 'Anna nimi.' }, { status: 400 });

  const hold = await createKammiHold({
    startISO,
    endISO,
    tier,
    email,
    name,
    phone,
    organization,
    eventInfo,
    hostQuestions,
    billingEmail,
  });
  if (!hold.ok) return NextResponse.json({ error: hold.error }, { status: 400 });
  const booking = hold.booking;

  try {
    const stripe = getStripe();
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? req.headers.get('origin') ?? '').replace(/\/$/, '');
    if (!appUrl) throw new Error('NEXT_PUBLIC_APP_URL puuttuu.');

    const label = `Kammi ${toISODate(booking.startDate)} – ${toISODate(booking.endDate)} (${booking.nights} yötä)`;
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: booking.totalCents,
            product_data: { name: label },
          },
        },
      ],
      customer_email: email,
      metadata: { kammiBookingId: booking.id },
      success_url: `${appUrl}/kammi/kiitos`,
      cancel_url: `${appUrl}/kammi`,
      locale: 'fi',
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    });

    await prisma.kammiBooking.update({
      where: { id: booking.id },
      data: { stripeSessionId: session.id },
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    // Release the hold so a failed Stripe init doesn't block the dates.
    await prisma.kammiBooking
      .update({ where: { id: booking.id }, data: { status: 'CANCELLED' } })
      .catch(() => {});
    console.error('Kammi-checkoutin luonti epäonnistui:', err);
    return NextResponse.json(
      { error: 'Maksun alustus epäonnistui. Yritä uudelleen.' },
      { status: 500 },
    );
  }
}
