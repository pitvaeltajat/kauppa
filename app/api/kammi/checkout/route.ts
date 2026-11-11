import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { getStripe } from '@/lib/stripe';
import { auth } from '@/lib/auth';
import { getUserRole, isEventAdmin } from '@/lib/admin';
import { createKammiHold } from '@/lib/kammiBookings';
import {
  trySendEmail,
  sendKammiConfirmationEmail,
  sendKammiHostNotificationEmail,
} from '@/lib/emails';
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
  const submittedOrganization = str(payload.organization, 200);
  const eventInfo = str(payload.eventInfo, 2000);
  const hostQuestions = str(payload.hostQuestions, 2000);
  const billingEmail =
    typeof payload.billingEmail === 'string' && payload.billingEmail.includes('@')
      ? payload.billingEmail.trim().slice(0, 254)
      : null;
  const paymentRequest = payload.paymentMode === 'request';
  const requestKey =
    typeof payload.requestKey === 'string' && /^[A-Za-z0-9:_-]{16,100}$/.test(payload.requestKey)
      ? payload.requestKey
      : null;

  if (!email)
    return NextResponse.json({ error: 'Anna sähköpostiosoite kuittia varten.' }, { status: 400 });
  if (!name) return NextResponse.json({ error: 'Anna nimesi.' }, { status: 400 });

  // A logged-in pitva member's scout booking is free — decided here from the
  // session, never from anything the browser sent.
  const session = await auth();
  const pitvaMember = isEventAdmin(await getUserRole(session?.user?.email ?? null));
  const free = pitvaMember && tier === 'SCOUT';
  const organization = pitvaMember && tier === 'SCOUT' ? 'PitVa' : submittedOrganization;

  if (requestKey) {
    const existing = await prisma.kammiBooking.findUnique({ where: { requestKey } });
    if (existing) {
      if (existing.status === 'CANCELLED') {
        return NextResponse.json({ error: 'Varaus on jo peruttu.' }, { status: 409 });
      }
      if (free || paymentRequest) {
        if (paymentRequest && !existing.paymentToken) {
          return NextResponse.json(
            { error: 'Varaus on jo käynnistymässä. Yritä hetken kuluttua uudelleen.' },
            { status: 409 },
          );
        }
        return NextResponse.json({
          url:
            paymentRequest && existing.paymentToken
              ? `/kammi/pay/${encodeURIComponent(existing.paymentToken)}`
              : '/kammi/kiitos',
        });
      }
      if (existing.stripeSessionId) {
        const existingSession = await getStripe().checkout.sessions.retrieve(
          existing.stripeSessionId,
        );
        return NextResponse.json({ url: existingSession.url });
      }
      return NextResponse.json(
        { error: 'Varaus on jo käynnistymässä. Yritä hetken kuluttua uudelleen.' },
        { status: 409 },
      );
    }
  }

  const holdInput = {
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
    requestKey,
  };

  if (free) {
    const result = await createKammiHold(holdInput, { free: true });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    // Confirmed immediately — send the keycode and notify the host.
    await trySendEmail(`kammi confirmation ${result.booking.id}`, () =>
      sendKammiConfirmationEmail(result.booking.id),
    );
    await trySendEmail(`kammi host notice ${result.booking.id}`, () =>
      sendKammiHostNotificationEmail(result.booking.id),
    );
    return NextResponse.json({ url: '/kammi/kiitos' });
  }

  const hold = await createKammiHold(holdInput, {
    holdMinutes: paymentRequest ? 24 * 60 : undefined,
  });
  if (!hold.ok) return NextResponse.json({ error: hold.error }, { status: 400 });
  const booking = hold.booking;

  if (paymentRequest) {
    const paymentToken = randomUUID();
    // A payer-separated booking is an intentional indefinite hold. It remains
    // visible as busy until the payer completes it or an admin cancels it.
    await prisma.kammiBooking.update({
      where: { id: booking.id },
      data: { paymentToken, holdExpiresAt: null },
    });
    return NextResponse.json({ url: `/kammi/pay/${encodeURIComponent(paymentToken)}` });
  }

  try {
    const stripe = getStripe();
    const appUrl = (
      process.env.NEXT_PUBLIC_APP_URL ??
      (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '')
    ).replace(/\/$/, '');
    if (!appUrl) throw new Error('NEXT_PUBLIC_APP_URL puuttuu.');

    const label = `Kammi ${toISODate(booking.startDate)} – ${toISODate(booking.endDate)} (${booking.nights} yötä)`;
    const session = await stripe.checkout.sessions.create(
      {
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
      },
      { idempotencyKey: requestKey ?? `kammi-checkout:${booking.id}` },
    );

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
      { error: 'Maksua ei voitu aloittaa. Yritä uudelleen.' },
      { status: 500 },
    );
  }
}
