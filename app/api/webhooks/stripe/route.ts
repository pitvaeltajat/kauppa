import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { getStripe } from '@/lib/stripe';
import { applyQuantityToStock } from '@/lib/orders';
import { trySendEmail, sendOrderReceiptEmail, sendNewOrderAdminEmail } from '@/lib/emails';

export const dynamic = 'force-dynamic';

/**
 * Stripe webhook receiver. Faithfully applied payments mark the Order PAID and
 * decrement stock; expired sessions cancel their RECEIVED order.
 *
 * Local dev: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
 * and set STRIPE_WEBHOOK_SECRET (whsec_...) from its output.
 */
export async function POST(req: Request) {
  const signature = req.headers.get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) {
    return NextResponse.json({ error: 'Webhook ei ole konfiguroitu.' }, { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await getStripe().webhooks.constructEventAsync(body, signature, secret);
  } catch (err) {
    console.error('Varmente epäonnistui:', err);
    return NextResponse.json({ error: 'Virheellinen allekirjoitus.' }, { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const orderId = session.metadata?.orderId;
      if (orderId) {
        const newlyPaid = await markOrderPaid(orderId, session);
        // Only mail on the real transition, so a duplicate webhook delivery
        // doesn't send the receipt twice. Failures are logged, not thrown —
        // a broken mailer must not make Stripe retry the whole payment.
        if (newlyPaid) {
          await trySendEmail(`order receipt ${orderId}`, () => sendOrderReceiptEmail(orderId));
          await trySendEmail(`new-order notice ${orderId}`, () => sendNewOrderAdminEmail(orderId));
        }
      } else {
        console.warn('checkout.session.completed ilman orderId:ta', session.id);
      }
      break;
    }
    case 'checkout.session.expired': {
      const session = event.data.object;
      const orderId = session.metadata?.orderId;
      if (orderId) {
        await prisma.order.updateMany({
          where: { id: orderId, status: 'RECEIVED' },
          data: { status: 'CANCELLED' },
        });
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}

/** Returns true only when this call performed the RECEIVED→PAID transition. */
async function markOrderPaid(
  orderId: string,
  session: Stripe.Checkout.Session,
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { lines: true },
    });
    if (!order || order.status === 'PAID' || order.status === 'COMPLETED') return false;

    const itemRows = await tx.item.findMany({
      where: { id: { in: order.lines.map((line) => line.itemId) } },
      select: { id: true, stock: true },
    });
    const stockById = new Map(itemRows.map((item) => [item.id, item.stock]));

    for (const result of applyQuantityToStock(
      order.lines.map((line) => ({
        itemId: line.itemId,
        stock: stockById.get(line.itemId) ?? null,
        quantity: line.quantity,
      })),
    )) {
      if (result.newStock !== null) {
        await tx.item.updateMany({
          where: { id: result.itemId, stock: { not: null } },
          data: { stock: result.newStock },
        });
      }
    }

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        stripeSessionId: session.id ?? order.stripeSessionId,
        stripePaymentIntent:
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : order.stripePaymentIntent,
        email: order.email ?? session.customer_details?.email ?? null,
        name: order.name ?? session.customer_details?.name ?? null,
      },
    });
    return true;
  });
}
