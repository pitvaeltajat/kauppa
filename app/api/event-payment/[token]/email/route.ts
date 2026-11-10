import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEventPaymentLinkEmail } from '@/lib/emails';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  let payload: { email?: unknown };
  try {
    payload = (await req.json()) as { email?: unknown };
  } catch {
    return NextResponse.json({ error: 'Virheellinen pyyntö.' }, { status: 400 });
  }
  const email = typeof payload.email === 'string' ? payload.email.trim().slice(0, 254) : '';
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Anna vanhemman sähköpostiosoite.' }, { status: 400 });
  }
  const order = await prisma.order.findUnique({ where: { paymentToken: token }, select: { id: true, status: true } });
  if (!order) return NextResponse.json({ error: 'Maksulinkkiä ei löydy.' }, { status: 404 });
  if (order.status !== 'RECEIVED') return NextResponse.json({ error: 'Ilmoittautuminen on jo käsitelty.' }, { status: 400 });
  await prisma.order.update({ where: { id: order.id }, data: { email } });
  await sendEventPaymentLinkEmail(order.id, email);
  return NextResponse.json({ sent: true });
}
