import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStripe } from '@/lib/stripe';

/** Opens the Stripe payment form for a child-created event registration. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
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
    include: { lines: { include: { item: { select: { isEvent: true } } } } },
  });
  if (!order || !order.lines.length || order.lines.some((line) => !line.item.isEvent)) {
    return NextResponse.json({ error: 'Maksulinkkiä ei löydy.' }, { status: 404 });
  }
  if (order.status !== 'RECEIVED') {
    return NextResponse.json({ status: order.status, alreadyPaid: order.status === 'PAID' });
  }

  const stripe = getStripe();
  if (order.stripePaymentIntent) {
    const intent = await stripe.paymentIntents.retrieve(order.stripePaymentIntent);
    if (email && !order.email) {
      await prisma.order.update({ where: { id: order.id }, data: { email } });
    }
    return NextResponse.json({ clientSecret: intent.client_secret, paymentIntentId: intent.id });
  }

  const intent = await stripe.paymentIntents.create({
    amount: order.totalCents,
    currency: 'eur',
    automatic_payment_methods: { enabled: true },
    receipt_email: email ?? undefined,
    description: `Pitkäjärven Vaeltajat -tapahtumailmoittautuminen ${order.id.slice(-8).toUpperCase()}`,
    metadata: { orderId: order.id },
  });
  await prisma.order.update({
    where: { id: order.id },
    data: { stripePaymentIntent: intent.id, email: email ?? undefined },
  });
  return NextResponse.json({ clientSecret: intent.client_secret, paymentIntentId: intent.id });
}
