import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { getStripe } from '@/lib/stripe';
import { buildCheckout, type CheckoutRequestItem } from '@/lib/checkout';
import {
  validateAndBuildAnswers,
  buildParticipantNames,
  splitParticipantAnswers,
  PARTICIPANT_NAME_QUESTION,
  DIETARY_REQUIREMENTS_QUESTION,
  type AnswersByItem,
  type ItemQuestionLike,
} from '@/lib/questions';
import { loadValidDiscount } from '@/lib/discountCodes';
import { normalizeCode } from '@/lib/discount';
import { sendNewOrderAdminEmail, sendOrderReceiptEmail, trySendEmail } from '@/lib/emails';

/**
 * Creates an Order row and a Stripe Checkout Session for the cart. Prices,
 * stock and any item question answers are re-validated against the database.
 * nothing the browser sent is trusted. In test mode this needs
 * STRIPE_SECRET_KEY (sk_test_) set.
 */
export async function POST(req: Request) {
  let payload: {
    items?: unknown;
    email?: unknown;
    name?: unknown;
    answers?: unknown;
    discountCode?: unknown;
    paymentMethod?: unknown;
    requestKey?: unknown;
  };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Virheellinen pyyntö.' }, { status: 400 });
  }

  const checkoutKey =
    typeof payload.requestKey === 'string' && /^[A-Za-z0-9:_-]{16,100}$/.test(payload.requestKey)
      ? payload.requestKey
      : null;
  if (checkoutKey) {
    let existing = await prisma.order.findUnique({
      where: { checkoutKey },
      include: { lines: { select: { item: { select: { isEvent: true } } } } },
    });
    if (existing) {
      if (payload.paymentMethod === 'deferred_event' && existing.paymentToken) {
        return NextResponse.json({
          paymentMethod: 'deferred_event',
          orderId: existing.id,
          paymentToken: existing.paymentToken,
        });
      }

      const isEventOrder =
        existing.lines.length > 0 && existing.lines.every((line) => line.item.isEvent);
      const switchingToDeferred =
        payload.paymentMethod === 'deferred_event' &&
        isEventOrder &&
        existing.status === 'RECEIVED' &&
        !existing.paymentToken &&
        Boolean(existing.stripeSessionId);
      const switchingToCard =
        payload.paymentMethod !== 'deferred_event' &&
        isEventOrder &&
        existing.status === 'RECEIVED' &&
        Boolean(existing.paymentToken) &&
        !existing.stripeSessionId;

      if (switchingToDeferred || switchingToCard) {
        if (existing.stripeSessionId) {
          const session = await getStripe().checkout.sessions.retrieve(existing.stripeSessionId);
          if (session.status === 'complete') {
            return NextResponse.json({
              paymentMethod: 'elements',
              clientSecret: session.client_secret,
              checkoutSessionId: session.id,
            });
          }
          if (session.status === 'open') await getStripe().checkout.sessions.expire(session.id);
        }

        const cancelled = await prisma.order.updateMany({
          where: {
            id: existing.id,
            status: 'RECEIVED',
            checkoutKey,
            stripeSessionId: existing.stripeSessionId,
          },
          data: {
            status: 'CANCELLED',
            stripeSessionId: null,
            paymentToken: null,
            checkoutKey: null,
            paymentLinkEmailSentAt: null,
          },
        });
        if (cancelled.count !== 1) {
          return NextResponse.json(
            { error: 'Maksutavan vaihto epäonnistui. Yritä uudelleen.' },
            { status: 409 },
          );
        }
        existing = null;
      }

      if (!existing) {
        // The cancelled order has released the idempotency key. Continue by
        // creating a fresh order for the newly selected payment method.
      } else if (existing.stripeSessionId) {
        const session = await getStripe().checkout.sessions.retrieve(existing.stripeSessionId);
        return NextResponse.json({
          paymentMethod: 'elements',
          clientSecret: session.client_secret,
          checkoutSessionId: session.id,
        });
      } else if (existing.status === 'PAID' && existing.totalCents === 0) {
        return NextResponse.json({ paymentMethod: 'free', orderId: existing.id });
      } else if (existing.invoiceUrl) {
        return NextResponse.json({
          paymentMethod: 'invoice',
          orderId: existing.id,
          invoiceAccessToken: existing.invoiceAccessToken,
          invoiceUrl: existing.invoiceUrl,
          invoicePdfUrl: existing.invoicePdfUrl,
        });
      } else {
        return NextResponse.json(
          { error: 'Maksu on jo käynnistymässä. Yritä hetken kuluttua uudelleen.' },
          { status: 409 },
        );
      }
    }
  }

  const raw = Array.isArray(payload.items) ? payload.items : [];
  const requested: CheckoutRequestItem[] = [];
  for (const entry of raw) {
    if (
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as { id?: unknown }).id === 'string' &&
      typeof (entry as { quantity?: unknown }).quantity === 'number'
    ) {
      requested.push({
        id: (entry as { id: string }).id,
        quantity: (entry as { quantity: number }).quantity,
        variantId:
          typeof (entry as { variantId?: unknown }).variantId === 'string'
            ? (entry as { variantId: string }).variantId
            : undefined,
      });
    }
  }

  const items = await prisma.item.findMany({
    where: {
      id: { in: requested.map((r) => r.id).filter((id): id is string => typeof id === 'string') },
    },
    include: { variants: true },
  });
  // Resolve the optional discount code. A typed-but-invalid code is rejected so
  // the buyer isn't silently charged full price; an empty field is fine.
  const typedCode =
    typeof payload.discountCode === 'string' ? normalizeCode(payload.discountCode) : '';
  const discount = typedCode ? await loadValidDiscount(typedCode) : null;
  if (typedCode && !discount) {
    return NextResponse.json({ error: 'Alennuskoodi ei kelpaa.' }, { status: 400 });
  }

  const result = buildCheckout(requested, items, discount);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // Item questions: validate the cart-supplied answers and snapshot them.
  const itemIds = result.lines.map((line) => line.itemId);
  const questionRows = await prisma.itemQuestion.findMany({
    where: { itemId: { in: itemIds } },
    orderBy: { sortOrder: 'asc' },
  });
  const eventItemIds = new Set(items.filter((i) => i.isEvent).map((i) => i.id));
  const invoiceRequested = payload.paymentMethod === 'invoice';
  const deferredEventPayment = payload.paymentMethod === 'deferred_event';
  const eventOnly = result.lines.every((line) => eventItemIds.has(line.itemId));
  if (invoiceRequested && !eventOnly) {
    return NextResponse.json(
      { error: 'Laskulla voi ilmoittautua vain tapahtumiin. Poista muut tuotteet korista.' },
      { status: 400 },
    );
  }
  if (deferredEventPayment && !eventOnly) {
    return NextResponse.json(
      { error: 'Vanhemman maksu-linkki toimii vain tapahtumailmoittautumisissa.' },
      { status: 400 },
    );
  }
  const questionsByItem: Record<string, ItemQuestionLike[]> = {};
  for (const itemId of itemIds) questionsByItem[itemId] = [];
  for (const q of questionRows) {
    questionsByItem[q.itemId]?.push({
      id: q.id,
      prompt: q.prompt,
      type: q.type,
      required: q.required,
      options: q.options as string[],
    });
  }
  for (const item of items) {
    if (item.isEvent) questionsByItem[item.id]?.unshift(DIETARY_REQUIREMENTS_QUESTION);
  }
  const answers =
    typeof payload.answers === 'object' && payload.answers !== null
      ? (payload.answers as AnswersByItem)
      : undefined;
  const quantityByItem = Object.fromEntries(
    result.lines.map((line) => [line.itemId, line.quantity]),
  );
  const answerResult = validateAndBuildAnswers(questionsByItem, answers, quantityByItem);
  if (!answerResult.ok) {
    return NextResponse.json({ error: answerResult.error }, { status: 400 });
  }

  // Events require one participant name per unit - validated against the real
  // quantity and prepended to that line's answer snapshot.
  for (const line of result.lines) {
    const raw = answers?.[line.itemId]?.[PARTICIPANT_NAME_QUESTION.id];
    const participants = buildParticipantNames(eventItemIds.has(line.itemId), line.quantity, raw);
    if (!participants.ok) {
      return NextResponse.json({ error: participants.error }, { status: 400 });
    }
    if (participants.snapshot) {
      (answerResult.snapshotsByItem[line.itemId] ??= []).unshift(participants.snapshot);
    }
  }

  const email =
    typeof payload.email === 'string' && payload.email.includes('@')
      ? payload.email.trim().slice(0, 254)
      : null;
  const name =
    typeof payload.name === 'string' && payload.name.trim()
      ? payload.name.trim().slice(0, 200)
      : null;
  if (invoiceRequested && !email) {
    return NextResponse.json(
      { error: 'Anna vanhemman sähköpostiosoite, johon lasku lähetetään.' },
      { status: 400 },
    );
  }
  if (invoiceRequested && result.totalCents <= 0) {
    return NextResponse.json(
      { error: 'Maksuttomaan ilmoittautumiseen ei tarvita laskua.' },
      { status: 400 },
    );
  }

  const order = await prisma.order.create({
    data: {
      status: 'RECEIVED',
      email,
      name,
      totalCents: result.totalCents,
      checkoutKey: checkoutKey ?? undefined,
      invoiceAccessToken: invoiceRequested ? randomUUID() : undefined,
      paymentToken: deferredEventPayment ? randomUUID() : undefined,
      lines: {
        create: result.lines.map((line) => {
          const snapshots = answerResult.snapshotsByItem[line.itemId] ?? [];
          const isEvent = eventItemIds.has(line.itemId);
          return {
            itemId: line.itemId,
            variantId: line.variantId,
            variantName: line.variantName,
            name: line.name,
            priceCents: line.priceCents,
            quantity: line.quantity,
            answers: isEvent ? [] : snapshots,
            ...(isEvent
              ? {
                  participants: {
                    create: splitParticipantAnswers(line.quantity, snapshots).map(
                      (participant) => ({
                        name: participant.name,
                        answers: participant.answers,
                      }),
                    ),
                  },
                }
              : {}),
          };
        }),
      },
    },
  });

  try {
    if (eventOnly && result.totalCents === 0) {
      await prisma.$transaction(async (tx) => {
        const lines = await tx.orderLine.findMany({
          where: { orderId: order.id },
          select: { itemId: true, quantity: true },
        });
        const itemRows = await tx.item.findMany({
          where: { id: { in: lines.map((line) => line.itemId) } },
          select: { id: true, stock: true },
        });
        const stockById = new Map(itemRows.map((item) => [item.id, item.stock]));
        for (const line of lines) {
          if (stockById.get(line.itemId) === null) continue;
          const updated = await tx.item.updateMany({
            where: { id: line.itemId, stock: { gte: line.quantity } },
            data: { stock: { decrement: line.quantity } },
          });
          if (updated.count !== 1)
            throw new Error('Tapahtuman paikat muuttuivat ilmoittautumisen aikana.');
        }
        await tx.order.update({
          where: { id: order.id },
          data: { status: 'PAID', paidAt: new Date() },
        });
      });
      await trySendEmail(`free order receipt ${order.id}`, () => sendOrderReceiptEmail(order.id));
      await trySendEmail(`free new-order notice ${order.id}`, () =>
        sendNewOrderAdminEmail(order.id),
      );
      return NextResponse.json({ paymentMethod: 'free', orderId: order.id });
    }
    if (deferredEventPayment) {
      await trySendEmail(`deferred event notice ${order.id}`, () =>
        sendNewOrderAdminEmail(order.id),
      );
      return NextResponse.json({
        paymentMethod: 'deferred_event',
        orderId: order.id,
        paymentToken: order.paymentToken,
      });
    }
    const stripe = getStripe();
    if (invoiceRequested) {
      const customer = await stripe.customers.create(
        {
          email: email ?? undefined,
          name: name ?? undefined,
          metadata: { orderId: order.id },
        },
        { idempotencyKey: `${checkoutKey ?? order.id}:customer` },
      );
      for (const line of result.lines) {
        await stripe.invoiceItems.create(
          {
            customer: customer.id,
            amount: line.priceCents * line.quantity,
            currency: 'eur',
            description: `${line.name} × ${line.quantity}`,
            metadata: {
              orderId: order.id,
              itemId: line.itemId,
              ...(line.variantId ? { variantId: line.variantId } : {}),
            },
          },
          { idempotencyKey: `${checkoutKey ?? order.id}:item:${line.itemId}` },
        );
      }
      const invoice = await stripe.invoices.create(
        {
          customer: customer.id,
          collection_method: 'send_invoice',
          pending_invoice_items_behavior: 'include',
          days_until_due: 14,
          description: `Pitkäjärven Vaeltajat -tapahtumailmoittautuminen ${order.id.slice(-8).toUpperCase()}`,
          footer: 'Ilmoittautuminen vahvistuu, kun lasku on maksettu.',
          metadata: { orderId: order.id },
        },
        { idempotencyKey: `${checkoutKey ?? order.id}:invoice` },
      );
      const finalized = await stripe.invoices.finalizeInvoice(invoice.id);
      const sent = await stripe.invoices.sendInvoice(finalized.id);
      await prisma.order.update({
        where: { id: order.id },
        data: {
          stripeCustomerId: customer.id,
          stripeInvoiceId: sent.id,
          invoiceUrl: sent.hosted_invoice_url,
          invoicePdfUrl: sent.invoice_pdf,
          invoiceDueAt: sent.due_date ? new Date(sent.due_date * 1000) : null,
          invoiceAccessTokenExpiresAt: sent.due_date ? new Date(sent.due_date * 1000) : null,
        },
      });
      return NextResponse.json({
        paymentMethod: 'invoice',
        invoiceAccessToken: order.invoiceAccessToken,
        invoiceUrl: sent.hosted_invoice_url,
        invoicePdfUrl: sent.invoice_pdf,
      });
    }

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin).replace(/\/$/, '');
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        ui_mode: 'elements',
        line_items: result.lines.map((line) => ({
          quantity: line.quantity,
          price_data: {
            currency: 'eur',
            unit_amount: line.priceCents,
            product_data: { name: line.name },
          },
        })),
        customer_email: email ?? undefined,
        metadata: { orderId: order.id },
        return_url: `${appUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
        locale: 'fi',
      },
      { idempotencyKey: checkoutKey ?? `checkout:${order.id}` },
    );
    if (!session.client_secret) throw new Error('Stripe ei palauttanut checkout-avainta.');

    await prisma.order.update({
      where: { id: order.id },
      data: { stripeSessionId: session.id },
    });
    return NextResponse.json({
      paymentMethod: 'elements',
      clientSecret: session.client_secret,
      checkoutSessionId: session.id,
    });
  } catch (err) {
    // Roll the order back so an unconfigured/errored Stripe does not litter
    // the admin with abandoned orders.
    await prisma.order.delete({ where: { id: order.id } }).catch(() => {});
    console.error('Checkout-sessionin luonti epäonnistui:', err);
    return NextResponse.json(
      { error: 'Maksua ei voitu aloittaa. Yritä uudelleen tai ota yhteyttä ylläpitoon.' },
      { status: 500 },
    );
  }
}
