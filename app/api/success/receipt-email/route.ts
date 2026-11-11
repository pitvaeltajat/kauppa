import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStripe } from '@/lib/stripe';
import { sendOrderReceiptEmail } from '@/lib/emails';

export async function POST(req: Request) {
  let payload: { sessionId?: unknown; email?: unknown };
  try {
    payload = (await req.json()) as { sessionId?: unknown; email?: unknown };
  } catch {
    return NextResponse.json({ error: 'Virheellinen pyyntö.' }, { status: 400 });
  }

  const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId.trim() : '';
  const email = typeof payload.email === 'string' ? payload.email.trim().slice(0, 254) : '';
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId) || !email.includes('@')) {
    return NextResponse.json({ error: 'Anna toimiva sähköpostiosoite.' }, { status: 400 });
  }

  const session = await getStripe().checkout.sessions.retrieve(sessionId);
  if (session.payment_status !== 'paid' || !session.metadata?.orderId) {
    return NextResponse.json({ error: 'Maksua ei ole vielä vahvistettu.' }, { status: 409 });
  }

  const order = await prisma.order.findUnique({
    where: { id: session.metadata.orderId },
    select: { id: true, status: true, email: true, stripeSessionId: true },
  });
  if (!order || order.stripeSessionId !== session.id || order.status !== 'PAID') {
    return NextResponse.json(
      { error: 'Tilausta ei voitu vahvistaa vielä. Yritä hetken kuluttua.' },
      { status: 409 },
    );
  }
  if (order.email) return NextResponse.json({ sent: true });

  const updated = await prisma.order.updateMany({
    where: { id: order.id, email: null },
    data: { email },
  });
  if (updated.count === 1) await sendOrderReceiptEmail(order.id);
  return NextResponse.json({ sent: true });
}
