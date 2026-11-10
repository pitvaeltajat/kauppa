import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStripe } from '@/lib/stripe';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const order = await prisma.order.findUnique({
    where: { paymentToken: token },
    select: { id: true, status: true, stripePaymentIntent: true },
  });
  if (!order) return NextResponse.json({ error: 'Maksulinkkiä ei löydy.' }, { status: 404 });
  if (order.status !== 'RECEIVED') {
    return NextResponse.json({ error: 'Ilmoittautumista ei voi enää perua.' }, { status: 400 });
  }

  if (order.stripePaymentIntent) {
    const intent = await getStripe().paymentIntents.retrieve(order.stripePaymentIntent);
    if (['succeeded', 'processing'].includes(intent.status)) {
      return NextResponse.json({ error: 'Maksu on jo aloitettu. Ota yhteyttä järjestäjään.' }, { status: 400 });
    }
    if (!['canceled', 'requires_payment_method'].includes(intent.status)) {
      await getStripe().paymentIntents.cancel(intent.id);
    }
  }

  await prisma.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' } });
  return NextResponse.json({ cancelled: true });
}
