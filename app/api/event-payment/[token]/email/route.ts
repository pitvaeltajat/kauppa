import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEventPaymentLinkEmail } from '@/lib/emails';

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
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
  const order = await prisma.order.findUnique({
    where: { paymentToken: token },
    select: { id: true, status: true, paymentLinkEmailSentAt: true },
  });
  if (!order) return NextResponse.json({ error: 'Maksulinkkiä ei löydy.' }, { status: 404 });
  if (order.status !== 'RECEIVED')
    return NextResponse.json({ error: 'Ilmoittautuminen on jo käsitelty.' }, { status: 400 });
  const cutoff = new Date(Date.now() - 60_000);
  const claimed = await prisma.order.updateMany({
    where: {
      id: order.id,
      status: 'RECEIVED',
      OR: [{ paymentLinkEmailSentAt: null }, { paymentLinkEmailSentAt: { lt: cutoff } }],
    },
    data: { email, paymentLinkEmailSentAt: new Date() },
  });
  if (claimed.count !== 1) {
    return NextResponse.json(
      { error: 'Maksuohje lähetettiin jo hetki sitten. Yritä uudelleen myöhemmin.' },
      { status: 429, headers: { 'Retry-After': '60' } },
    );
  }
  await sendEventPaymentLinkEmail(order.id, email);
  return NextResponse.json({ sent: true });
}
