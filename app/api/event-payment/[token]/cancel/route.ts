import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStripe } from '@/lib/stripe';
import { sendEventCancellationEmail, trySendEmail } from '@/lib/emails';
import { canCancelEventRegistration } from '@/lib/event-registration';

export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const order = await prisma.order.findUnique({
    where: { paymentToken: token },
    select: {
      id: true,
      status: true,
      totalCents: true,
      stripeSessionId: true,
      lines: { select: { item: { select: { registrationDeadline: true } } } },
    },
  });
  if (!order) return NextResponse.json({ error: 'Maksulinkkiä ei löydy.' }, { status: 404 });
  if (!['RECEIVED', 'PAID', 'COMPLETED'].includes(order.status)) {
    return NextResponse.json({ error: 'Ilmoittautumista ei voi enää perua.' }, { status: 400 });
  }
  const deadlines = order.lines
    .map((line) => line.item.registrationDeadline)
    .filter((deadline): deadline is Date => Boolean(deadline));
  const deadline = deadlines.length
    ? new Date(Math.min(...deadlines.map((value) => value.getTime())))
    : null;
  if (!canCancelEventRegistration(deadline)) {
    return NextResponse.json(
      { error: 'IlmoDL on päättynyt. Ilmoittautumista ei voi enää perua tämän linkin kautta.' },
      { status: 400 },
    );
  }

  if (['PAID', 'COMPLETED'].includes(order.status) && order.totalCents > 0) {
    if (!order.stripeSessionId) {
      return NextResponse.json(
        { error: 'Maksun palautus pitää käsitellä ylläpidossa.' },
        { status: 400 },
      );
    }
    try {
      const session = await getStripe().checkout.sessions.retrieve(order.stripeSessionId, {
        expand: ['payment_intent'],
      });
      const paymentIntent = session.payment_intent;
      const paymentIntentId =
        typeof paymentIntent === 'string' ? paymentIntent : paymentIntent?.id ?? null;
      if (!paymentIntentId) throw new Error('Maksun tunnistetta ei löytynyt.');
      await getStripe().refunds.create(
        { payment_intent: paymentIntentId },
        { idempotencyKey: `event-registration-refund:${order.id}` },
      );
    } catch (error) {
      console.error('Tapahtumamaksun palautus epäonnistui:', error);
      return NextResponse.json(
        { error: 'Maksua ei voitu palauttaa automaattisesti. Ota yhteyttä ylläpitoon.' },
        { status: 502 },
      );
    }
  }

  await prisma.order.updateMany({
    where: { id: order.id, status: { in: ['RECEIVED', 'PAID', 'COMPLETED'] } },
    data: { status: 'CANCELLED' },
  });
  await trySendEmail(`event cancellation ${order.id}`, () => sendEventCancellationEmail(order.id));
  return NextResponse.json({ cancelled: true });
}
