import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEventCancellationEmail, trySendEmail } from '@/lib/emails';

export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const order = await prisma.order.findUnique({
    where: { paymentToken: token },
    select: { id: true, status: true },
  });
  if (!order) return NextResponse.json({ error: 'Maksulinkkiä ei löydy.' }, { status: 404 });
  if (order.status !== 'RECEIVED') {
    return NextResponse.json({ error: 'Ilmoittautumista ei voi enää perua.' }, { status: 400 });
  }

  await prisma.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' } });
  await trySendEmail(`event cancellation ${order.id}`, () => sendEventCancellationEmail(order.id));
  return NextResponse.json({ cancelled: true });
}
