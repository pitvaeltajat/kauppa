import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStripe } from '@/lib/stripe';
import { buildCheckout, type CheckoutRequestItem } from '@/lib/checkout';
import {
  validateAndBuildAnswers,
  buildParticipantNames,
  PARTICIPANT_NAME_QUESTION,
  type AnswersByItem,
  type ItemQuestionLike,
} from '@/lib/questions';
import { loadValidDiscount } from '@/lib/discountCodes';
import { normalizeCode } from '@/lib/discount';

/**
 * Creates an Order row and a Stripe Checkout Session for the cart. Prices,
 * stock and any item question answers are re-validated against the database —
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
  };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Virheellinen pyyntö.' }, { status: 400 });
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
      });
    }
  }

  const items = await prisma.item.findMany({
    where: { id: { in: requested.map((r) => r.id).filter((id): id is string => typeof id === 'string') } },
  });
  // Resolve the optional discount code. A typed-but-invalid code is rejected so
  // the buyer isn't silently charged full price; an empty field is fine.
  const typedCode = typeof payload.discountCode === 'string' ? normalizeCode(payload.discountCode) : '';
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
  const answers = (typeof payload.answers === 'object' && payload.answers !== null
    ? (payload.answers as AnswersByItem)
    : undefined);
  const answerResult = validateAndBuildAnswers(questionsByItem, answers);
  if (!answerResult.ok) {
    return NextResponse.json({ error: answerResult.error }, { status: 400 });
  }

  // Events require one participant name per unit — validated against the real
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
    typeof payload.name === 'string' && payload.name.trim() ? payload.name.trim().slice(0, 200) : null;

  const order = await prisma.order.create({
    data: {
      status: 'RECEIVED',
      email,
      name,
      totalCents: result.totalCents,
      lines: {
        create: result.lines.map((line) => ({
          itemId: line.itemId,
          name: line.name,
          priceCents: line.priceCents,
          quantity: line.quantity,
          answers: answerResult.snapshotsByItem[line.itemId] ?? [],
        })),
      },
    },
  });

  let url: string | null = null;
  try {
    const stripe = getStripe();
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? req.headers.get('origin') ?? '').replace(/\/$/, '');
    if (!appUrl) throw new Error('NEXT_PUBLIC_APP_URL puuttuu.');

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
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
      success_url: `${appUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/cart`,
      locale: 'fi',
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { stripeSessionId: session.id },
    });
    url = session.url;
  } catch (err) {
    // Roll the order back so an unconfigured/errored Stripe does not litter
    // the admin with abandoned orders.
    await prisma.order.delete({ where: { id: order.id } }).catch(() => {});
    console.error('Checkout-sessionin luonti epäonnistui:', err);
    return NextResponse.json(
      { error: 'Maksun alustus epäonnistui. Onko Stripe konfiguroitu? Tarkista STRIPE_SECRET_KEY.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ url });
}
