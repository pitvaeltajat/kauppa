import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStripe } from '@/lib/stripe';

/** Opens a Stripe Checkout Session for a child-created event registration. */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token || token.length > 100) {
    return NextResponse.json({ error: 'Maksulinkki ei kelpaa.' }, { status: 400 });
  }

  let payload: { email?: unknown } = {};
  try {
    payload = (await req.json()) as { email?: unknown };
  } catch {
    // Email is optional; Stripe can collect it in its payment form.
  }
  const email =
    typeof payload.email === 'string' && payload.email.includes('@')
      ? payload.email.trim().slice(0, 254)
      : null;

  const order = await prisma.order.findUnique({
    where: { paymentToken: token },
    include: {
      lines: {
        include: { item: { select: { isEvent: true } } },
      },
    },
  });
  if (!order || !order.lines.length || order.lines.some((line) => !line.item.isEvent)) {
    return NextResponse.json({ error: 'Maksulinkkiä ei löydy.' }, { status: 404 });
  }
  if (order.status !== 'RECEIVED') {
    return NextResponse.json({ status: order.status, alreadyPaid: order.status === 'PAID' });
  }

  const stripe = getStripe();
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin).replace(/\/$/, '');
  if (order.stripeSessionId) {
    const session = await stripe.checkout.sessions.retrieve(order.stripeSessionId);
    if (session.url) return NextResponse.json({ checkoutUrl: session.url });
  }
  const session = await stripe.checkout.sessions.create(
    {
      mode: 'payment',
      line_items: order.lines.map((line) => ({
        quantity: line.quantity,
        price_data: {
          currency: 'eur',
          unit_amount: line.priceCents,
          product_data: { name: line.name },
        },
      })),
      customer_email: email ?? order.email ?? undefined,
      metadata: { orderId: order.id },
      success_url: `${appUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/event-payment/${encodeURIComponent(token)}`,
      locale: 'fi',
    },
    { idempotencyKey: `event-payment:${order.id}` },
  );
  if (!session.url) throw new Error('Stripe ei palauttanut checkout-osoitetta.');
  await prisma.order.update({
    where: { id: order.id },
    data: { stripeSessionId: session.id, email: email ?? undefined },
  });
  return NextResponse.json({ checkoutUrl: session.url });
}
