'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { StripeExpressCheckoutElementConfirmEvent } from '@stripe/stripe-js';
import {
  CheckoutElementsProvider,
  ExpressCheckoutElement,
  PaymentElement,
  useCheckoutElements,
} from '@stripe/react-stripe-js/checkout';
import { loadStripe } from '@stripe/stripe-js';
import { Minus, Plus, Trash2, ShoppingCart } from 'lucide-react';
import { cartStore, useCart } from '@/lib/cart';
import { formatCents } from '@/lib/money';
import {
  type DiscountCodeLike,
  discountApplies,
  discountedUnitCents,
  normalizeCode,
} from '@/lib/discount';
import { Button } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ItemImage } from '@/components/item-image';
import { LoadingPill } from '@/components/ui/loading-pill';
import { PARTICIPANT_NAME_QUESTION } from '@/lib/questions';

type CheckoutQuestion = {
  id: string;
  prompt: string;
  type: 'TEXT' | 'NUMBER' | 'RADIO' | 'CHECKBOX';
  required: boolean;
  options: string[];
};

type FetchedItem = {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  stock: number | null;
  isEvent: boolean;
  leaderDiscount: boolean;
  variants: { id: string; name: string | null; priceCents: number }[];
  questions: CheckoutQuestion[];
};

type AnswerValue = string | string[];
type Answers = Record<string, Record<string, AnswerValue[]>>;

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

export function CartShell({ initialUser }: { initialUser: { name: string; email: string } }) {
  const router = useRouter();
  const { items } = useCart();
  const [catalog, setCatalog] = useState<Map<string, FetchedItem>>(new Map());
  const [catalogLoadedFor, setCatalogLoadedFor] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [email, setEmail] = useState(initialUser.email);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [discount, setDiscount] = useState<DiscountCodeLike | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeChecking, setCodeChecking] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const checkoutRequestKey = useRef<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'deferred'>('card');
  const participantNamesPrefilled = useRef(false);
  const autoCheckoutStarted = useRef(false);

  const ids = useMemo(() => items.map((i) => i.id).sort(), [items]);
  const idsKey = ids.join(',');
  const catalogLoaded = catalogLoadedFor === idsKey;

  // Fetch fresh catalog rows for whatever is in the cart.
  useEffect(() => {
    if (ids.length === 0) return;
    let cancelled = false;
    fetch(`/api/items?ids=${ids.map(encodeURIComponent).join(',')}`)
      .then((r) => r.json())
      .then((data: { items?: FetchedItem[] }) => {
        if (cancelled) return;
        setCatalog(new Map((data.items ?? []).map((item) => [item.id, item])));
        setCatalogLoadedFor(idsKey);
      })
      .catch(() => {
        if (!cancelled)
          setError('Tuotteiden tietoja ei voitu ladata. Päivitä sivu ja yritä uudelleen.');
      });
    return () => {
      cancelled = true;
    };
  }, [ids, idsKey]);

  const lines = items.flatMap((cartItem) => {
    const item = catalog.get(cartItem.id);
    const variant =
      item?.variants.find((candidate) => candidate.id === cartItem.variantId) ??
      (item?.variants.length === 1 ? item.variants[0] : undefined);
    return [{ cartItem, item, variant }];
  });
  const eventOnly = lines.length > 0 && lines.every(({ item }) => item?.isEvent === true);
  const hasInvalidVariant = lines.some(({ item, variant }) => item && !variant);
  const deferredCheckout = eventOnly && paymentMethod === 'deferred';

  // A signed-in user's details are the convenient default, but only fill empty
  // fields once so changing the cart or editing a field never overwrites input.
  useEffect(() => {
    if (!catalogLoaded || !initialUser.name.trim() || participantNamesPrefilled.current) return;
    setAnswers((prev) => {
      const next = { ...prev };
      for (const { cartItem } of lines) {
        const item = catalog.get(cartItem.id);
        const participantQuestion = item?.questions.find(
          (question) => question.id === PARTICIPANT_NAME_QUESTION.id,
        );
        if (!item || !participantQuestion) continue;
        const itemAnswers = { ...(next[item.id] ?? {}) };
        const values = [...(itemAnswers[participantQuestion.id] ?? [])];
        if (!values[0]) values[0] = initialUser.name;
        itemAnswers[participantQuestion.id] = values;
        next[item.id] = itemAnswers;
      }
      return next;
    });
    participantNamesPrefilled.current = true;
  }, [catalog, catalogLoaded, initialUser.name, lines]);

  const totalCents = lines.reduce((sum, { cartItem, variant }) => {
    return sum + (variant?.priceCents ?? 0) * cartItem.quantity;
  }, 0);

  // Discount preview (UX only - checkout re-validates against the database).
  const discountCents = discount
    ? lines.reduce((sum, { cartItem, item, variant }) => {
        if (!item || !discountApplies(discount, item)) return sum;
        const priceCents = variant?.priceCents ?? 0;
        const saved = priceCents - discountedUnitCents(priceCents, discount.percentOff);
        return sum + saved * cartItem.quantity;
      }, 0)
    : 0;
  const freeEventRegistration =
    eventOnly && catalogLoaded && !hasInvalidVariant && totalCents - discountCents === 0;

  async function applyCode() {
    const code = normalizeCode(codeInput);
    if (!code) return;
    setCodeError(null);
    setCodeChecking(true);
    try {
      const res = await fetch(`/api/discount?code=${encodeURIComponent(code)}`);
      const data = (await res.json()) as { discount?: DiscountCodeLike; error?: string };
      if (!res.ok || !data.discount) {
        setDiscount(null);
        setCodeError(data.error ?? 'Alennuskoodi ei kelpaa.');
        return;
      }
      setDiscount(data.discount);
      setCodeInput(data.discount.code);
    } catch {
      setCodeError('Koodin tarkistus epäonnistui. Yritä uudelleen.');
    } finally {
      setCodeChecking(false);
    }
  }

  function removeCode() {
    setDiscount(null);
    setCodeInput('');
    setCodeError(null);
  }

  function setAnswer(
    itemId: string,
    questionId: string,
    participantIndex: number,
    value: AnswerValue,
  ) {
    setAnswers((prev) => {
      const values = [...(prev[itemId]?.[questionId] ?? [])];
      values[participantIndex] = value;
      return {
        ...prev,
        [itemId]: { ...prev[itemId], [questionId]: values },
      };
    });
  }

  const missingAnswerMessage = useCallback(
    (item: FetchedItem, quantity: number): string | null => {
      const itemAnswers = answers[item.id] ?? {};
      for (let participantIndex = 0; participantIndex < quantity; participantIndex++) {
        for (const question of item.questions) {
          const value = itemAnswers[question.id]?.[participantIndex];
          if (
            question.id === PARTICIPANT_NAME_QUESTION.id &&
            (!value || typeof value !== 'string' || value.trim() === '')
          ) {
            return `Anna jokaisen osallistujan nimi (${item.name}).`;
          }
          const empty =
            value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
          if (
            empty &&
            (question.required || question.type === 'RADIO' || question.type === 'CHECKBOX')
          ) {
            return `Vastaa kysymykseen "${question.prompt}" (${item.name}).`;
          }
        }
      }
      return null;
    },
    [answers],
  );

  const goToCheckout = useCallback(async () => {
    setError(null);
    if (lines.length === 0 || lines.some(({ item }) => !item)) {
      setError('Jokin korin tuotteista ei ole enää myynnissä. Poista se korista.');
      return;
    }
    if (hasInvalidVariant) {
      setError(
        'Jokin tuotteen vaihtoehto ei ole enää saatavilla. Poista tuote korista ja lisää se uudelleen.',
      );
      return;
    }
    for (const { cartItem, item } of lines) {
      if (item && item.questions.length > 0) {
        const missing = missingAnswerMessage(item, cartItem.quantity);
        if (missing) {
          setError(missing);
          return;
        }
      }
    }
    setLoading(true);
    try {
      checkoutRequestKey.current ??= crypto.randomUUID();
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((i) => ({
            id: i.id,
            variantId: i.variantId,
            quantity: i.quantity,
          })),
          answers,
          name: initialUser.name.trim() || undefined,
          // A child’s account email must not become the parent’s receipt
          // address when the parent-payment flow is selected.
          email: deferredCheckout ? undefined : email.trim() || undefined,
          discountCode: discount?.code,
          paymentMethod: deferredCheckout ? 'deferred_event' : 'card',
          requestKey: checkoutRequestKey.current,
        }),
      });
      const data = (await res.json()) as {
        paymentMethod?: 'elements' | 'invoice' | 'deferred_event' | 'free';
        clientSecret?: string | null;
        orderId?: string;
        invoiceAccessToken?: string | null;
        paymentToken?: string | null;
        invoiceUrl?: string | null;
        invoicePdfUrl?: string | null;
        error?: string;
      };
      if (!res.ok) {
        autoCheckoutStarted.current = false;
        checkoutRequestKey.current = null;
        setError(data.error ?? 'Maksua ei voitu aloittaa. Yritä uudelleen.');
        return;
      }
      if (data.paymentMethod === 'deferred_event' && data.paymentToken) {
        cartStore.clear();
        router.push(`/event-payment/${encodeURIComponent(data.paymentToken)}`);
        return;
      }
      if (data.paymentMethod === 'free' && data.orderId) {
        cartStore.clear();
        router.push(`/success?order_id=${encodeURIComponent(data.orderId)}`);
        return;
      }
      if (data.paymentMethod === 'invoice' && data.invoiceAccessToken) {
        cartStore.clear();
        router.push(`/invoice/success?token=${encodeURIComponent(data.invoiceAccessToken)}`);
        return;
      }
      if (data.paymentMethod === 'elements' && data.clientSecret) {
        setClientSecret(data.clientSecret);
        return;
      }
      if (!data.clientSecret) {
        autoCheckoutStarted.current = false;
        setError('Maksua ei voitu aloittaa. Yritä uudelleen.');
        return;
      }
    } catch {
      autoCheckoutStarted.current = false;
      setError('Maksua ei voitu aloittaa. Tarkista yhteys ja yritä uudelleen.');
    } finally {
      setLoading(false);
    }
  }, [
    answers,
    deferredCheckout,
    discount,
    email,
    initialUser.name,
    items,
    lines,
    hasInvalidVariant,
    missingAnswerMessage,
    router,
  ]);

  useEffect(() => {
    if (
      !catalogLoaded ||
      eventOnly ||
      deferredCheckout ||
      freeEventRegistration ||
      hasInvalidVariant ||
      clientSecret ||
      loading ||
      autoCheckoutStarted.current
    ) {
      return;
    }
    if (lines.length === 0 || lines.some(({ item }) => !item)) return;
    if (lines.some(({ cartItem, item }) => item && missingAnswerMessage(item, cartItem.quantity))) {
      return;
    }
    autoCheckoutStarted.current = true;
    const timer = window.setTimeout(() => void goToCheckout(), 0);
    return () => window.clearTimeout(timer);
  }, [
    answers,
    catalogLoaded,
    deferredCheckout,
    discount,
    email,
    eventOnly,
    clientSecret,
    freeEventRegistration,
    hasInvalidVariant,
    goToCheckout,
    lines,
    loading,
    missingAnswerMessage,
  ]);

  const cardCheckoutReady =
    catalogLoaded &&
    lines.length > 0 &&
    !lines.some(({ item }) => !item) &&
    !lines.some(({ cartItem, item }) => item && missingAnswerMessage(item, cartItem.quantity));

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed bg-card px-6 py-16 text-center">
        <ShoppingCart className="size-10 text-muted-foreground" />
        <div>
          <h2 className="text-lg font-bold">Ostoskori on tyhjä</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Korissa näkyvät valitsemasi tuotteet ja tapahtumailmoittautumiset.
          </p>
        </div>
        <ButtonLink href="/" variant="cta">
          Tutustu tuotteisiin
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
      {/* Lines */}
      <div className="space-y-3">
        {lines.map(({ cartItem, item, variant }) => (
          <div
            key={`${cartItem.id}:${cartItem.variantId ?? ''}`}
            className="rounded-lg border bg-card p-3 shadow-sm sm:p-4"
          >
            <div className="flex items-start gap-3 sm:gap-4">
              <Link href={item ? `/${item.slug}` : '#'} className="w-16 shrink-0 sm:w-20">
                <ItemImage src={item?.imageUrl} alt={item?.name ?? 'Tuote'} />
              </Link>
              <div className="min-w-0 flex-1">
                {item ? (
                  <>
                    <Link href={`/${item.slug}`} className="font-medium hover:underline">
                      {item.name}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {variant
                        ? item.isEvent && variant.priceCents === 0
                          ? 'Maksuton ilmoittautuminen'
                          : `${formatCents(variant.priceCents)} / kpl`
                        : 'Vaihtoehto ei ole enää saatavilla'}
                      {variant?.name ? ` - ${variant.name}` : ''}
                    </p>
                  </>
                ) : catalogLoaded ? (
                  <>
                    <p className="font-medium">Tuote ei ole enää myynnissä</p>
                    <p className="text-sm text-muted-foreground">
                      Poista tuote korista, jotta voit jatkaa.
                    </p>
                  </>
                ) : (
                  <>
                    <LoadingPill className="h-5 w-40 max-w-full bg-muted" />
                    <LoadingPill className="mt-1.5 h-4 w-24 bg-muted" />
                  </>
                )}
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex h-8 items-center rounded-md border border-input bg-background">
                    <button
                      type="button"
                      aria-label="Vähennä"
                      className="flex h-full w-8 items-center justify-center text-muted-foreground hover:text-foreground"
                      onClick={() =>
                        cartStore.setQuantity(
                          cartItem.id,
                          cartItem.quantity - 1,
                          cartItem.variantId,
                        )
                      }
                    >
                      <Minus className="size-3.5" />
                    </button>
                    <span className="w-8 text-center text-sm">{cartItem.quantity}</span>
                    <button
                      type="button"
                      aria-label="Lisää"
                      className="flex h-full w-8 items-center justify-center text-muted-foreground hover:text-foreground"
                      onClick={() =>
                        cartStore.setQuantity(
                          cartItem.id,
                          cartItem.quantity + 1,
                          cartItem.variantId,
                        )
                      }
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                  {item && (
                    <span className="text-sm font-semibold">
                      {variant ? formatCents(variant.priceCents * cartItem.quantity) : '–'}
                    </span>
                  )}
                  <button
                    type="button"
                    aria-label="Poista korista"
                    className="ml-auto text-muted-foreground transition-colors hover:text-destructive"
                    onClick={() => cartStore.remove(cartItem.id, cartItem.variantId)}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Checkout questions span the full card width so inputs have room on mobile. */}
            {item && item.questions.length > 0 && (
              <div className="mt-4 space-y-3 border-t pt-4">
                {Array.from({ length: cartItem.quantity }).map((_, participantIndex) => (
                  <div
                    key={participantIndex}
                    className={
                      cartItem.quantity > 1
                        ? 'space-y-4 rounded-md border bg-background/50 p-3 sm:p-4'
                        : 'space-y-4'
                    }
                  >
                    {cartItem.quantity > 1 && (
                      <p className="text-sm font-semibold">
                        {item.isEvent ? 'Osallistuja' : 'Tuote'} {participantIndex + 1}
                      </p>
                    )}
                    {item.questions.map((question) => {
                      const current = answers[item.id]?.[question.id]?.[participantIndex];

                      return (
                        <div key={question.id} className="space-y-2">
                          <Label className="text-xs font-medium">
                            {question.prompt}
                            {!question.required && (
                              <span className="ml-1 font-normal text-muted-foreground">
                                (valinnainen)
                              </span>
                            )}
                          </Label>
                          {question.type === 'TEXT' && (
                            <Input
                              value={typeof current === 'string' ? current : ''}
                              onChange={(e) =>
                                setAnswer(item.id, question.id, participantIndex, e.target.value)
                              }
                              placeholder={question.prompt}
                            />
                          )}
                          {question.type === 'NUMBER' && (
                            <Input
                              type="number"
                              inputMode="decimal"
                              value={typeof current === 'string' ? current : ''}
                              onChange={(e) =>
                                setAnswer(item.id, question.id, participantIndex, e.target.value)
                              }
                              placeholder="luku"
                            />
                          )}
                          {question.type === 'RADIO' && (
                            <div className="flex flex-wrap gap-x-4 gap-y-2">
                              {question.options.map((option) => (
                                <label
                                  key={option}
                                  className="flex cursor-pointer items-center gap-2 text-sm"
                                >
                                  <input
                                    type="radio"
                                    name={`q-${item.id}-${question.id}-${participantIndex}`}
                                    className="size-4 accent-[hsl(244,51%,24%)]"
                                    checked={current === option}
                                    onChange={() =>
                                      setAnswer(item.id, question.id, participantIndex, option)
                                    }
                                  />
                                  {option}
                                </label>
                              ))}
                            </div>
                          )}
                          {question.type === 'CHECKBOX' && (
                            <div className="flex flex-wrap gap-x-4 gap-y-2">
                              {question.options.map((option) => {
                                const selected = Array.isArray(current) ? current : [];
                                return (
                                  <label
                                    key={option}
                                    className="flex cursor-pointer items-center gap-2 text-sm"
                                  >
                                    <input
                                      type="checkbox"
                                      className="size-4 accent-[hsl(244,51%,24%)]"
                                      checked={selected.includes(option)}
                                      onChange={(e) => {
                                        const next = e.target.checked
                                          ? [...selected, option]
                                          : selected.filter((o) => o !== option);
                                        setAnswer(item.id, question.id, participantIndex, next);
                                      }}
                                    />
                                    {option}
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="h-fit space-y-4 rounded-lg border bg-card p-4 shadow-sm sm:p-5">
        <h2 className="text-lg font-bold">Yhteenveto</h2>

        {/* Discount code */}
        <div className="space-y-2 border-b pb-4">
          <Label htmlFor="discount-code">Alennuskoodi</Label>
          {discount ? (
            <div className="flex items-center justify-between gap-2 rounded-md bg-primary/10 px-3 py-2 text-sm">
              <span>
                <span className="font-mono font-semibold">{discount.code}</span>
                <span className="ml-1 text-muted-foreground">−{discount.percentOff} %</span>
              </span>
              <button
                type="button"
                className="text-muted-foreground underline-offset-2 hover:text-destructive hover:underline"
                onClick={removeCode}
              >
                Poista
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                id="discount-code"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    applyCode();
                  }
                }}
                placeholder="Syötä alennuskoodi"
                spellCheck={false}
                autoCapitalize="characters"
                className="font-mono uppercase"
              />
              <Button
                type="button"
                variant="secondary"
                disabled={codeChecking || !codeInput.trim()}
                onClick={applyCode}
              >
                {codeChecking ? <LoadingPill className="bg-current/25" /> : 'Käytä'}
              </Button>
            </div>
          )}
          {codeError && <p className="text-xs text-destructive">{codeError}</p>}
          {discount?.leaderOnly && discountCents === 0 && (
            <p className="text-xs text-muted-foreground">
              Koodi koskee vain tapahtumia, joissa johtajien alennus on käytössä.
            </p>
          )}
        </div>

        <div className="space-y-1.5 text-sm">
          {freeEventRegistration ? (
            <div className="flex items-center justify-between">
              <span>Ilmoittautuminen</span>
              <span className="text-lg font-bold">Maksuton</span>
            </div>
          ) : discountCents > 0 ? (
            <>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Välisumma</span>
                <span>{formatCents(totalCents)}</span>
              </div>
              <div className="flex items-center justify-between text-primary">
                <span>Alennus ({discount?.code})</span>
                <span>−{formatCents(discountCents)}</span>
              </div>
              <div className="flex items-center justify-between pt-1 font-bold">
                <span>Yhteensä</span>
                <span className="text-lg">{formatCents(totalCents - discountCents)}</span>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between">
              <span>Yhteensä</span>
              <span className="text-lg font-bold">{formatCents(totalCents)}</span>
            </div>
          )}
        </div>

        <div className="space-y-3 border-t pt-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">
              {deferredCheckout
                ? 'Sähköposti (valinnainen, kuitti lähetetään tähän)'
                : 'Sähköposti (kuitti lähetetään tähän)'}
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={deferredCheckout ? 'vanhempi@example.com' : 'etunimi@example.com'}
            />
          </div>
        </div>

        {eventOnly && catalogLoaded && !freeEventRegistration && (
          <fieldset className="space-y-2 border-t pt-4">
            <legend className="text-sm font-medium">Maksutapa</legend>
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="radio"
                name="payment-method"
                className="mt-0.5 size-4 accent-[hsl(244,51%,24%)]"
                checked={paymentMethod === 'card'}
                onChange={() => {
                  setPaymentMethod('card');
                  setError(null);
                }}
              />
              <span>
                <span className="font-medium">Maksa itse</span>
                <span className="block text-xs text-muted-foreground">
                  Maksu tapahtuu heti turvallisella maksulomakkeella.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="radio"
                name="payment-method"
                className="mt-0.5 size-4 accent-[hsl(244,51%,24%)]"
                checked={paymentMethod === 'deferred'}
                onChange={() => {
                  setPaymentMethod('deferred');
                  setError(null);
                }}
              />
              <span>
                <span className="font-medium">Vanhempi maksaa myöhemmin</span>
                <span className="block text-xs text-muted-foreground">
                  Saat jaettavan maksuohjeen. Vanhempi voi maksaa turvallisesti omalla laitteellaan.
                </span>
              </span>
            </label>
          </fieldset>
        )}

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        )}

        {clientSecret && stripePromise && !deferredCheckout ? (
          <CheckoutElementsProvider
            stripe={stripePromise}
            options={{
              clientSecret,
              elementsOptions: {
                appearance: {
                  theme: 'stripe',
                  variables: { colorPrimary: 'hsl(244, 51%, 24%)', borderRadius: '6px' },
                },
              },
            }}
          >
            <PaymentForm loading={loading} onError={setError} onLoading={setLoading} />
          </CheckoutElementsProvider>
        ) : !eventOnly && !deferredCheckout && !freeEventRegistration && cardCheckoutReady && !error ? (
          <div className="flex min-h-11 items-center justify-center gap-2 rounded-md bg-muted px-4 py-2 text-sm text-muted-foreground">
            <LoadingPill /> Valmistellaan maksutapoja…
          </div>
        ) : (
          <Button
            variant="cta"
            size="lg"
            className="w-full"
            disabled={loading || lines.length === 0}
            onClick={goToCheckout}
          >
            {loading ? (
              <LoadingPill className="bg-current/25" />
            ) : deferredCheckout ? (
              'Ilmoittaudu ja pyydä vanhempaa maksamaan'
            ) : freeEventRegistration ? (
              'Ilmoittaudu (maksuton)'
            ) : (
              'Jatka maksamiseen'
            )}
          </Button>
        )}
        <p className="text-center text-xs text-muted-foreground">
          {freeEventRegistration
            ? 'Tämä tapahtuma on maksuton. Ilmoittautuminen vahvistetaan heti.'
            : deferredCheckout
              ? 'Ilmoittautuminen vahvistuu, kun vanhempi maksaa jaettavan maksuohjeen kautta.'
              : eventOnly
                ? 'Maksat tapahtuman verkossa. Tapahtumatuotteen ostaminen toimii samalla ilmoittautumisena. Saat kuitin sähköpostiisi.'
                : 'Maksat tuotteen verkossa ja noudat sen kokouksessa ryhmänjohtajalta tai erikseen sovittuna aikana kololta. Saat kuitin sähköpostiisi.'}
        </p>
      </div>
    </div>
  );
}

function PaymentForm({
  loading,
  onError,
  onLoading,
}: {
  loading: boolean;
  onError: (message: string | null) => void;
  onLoading: (loading: boolean) => void;
}) {
  const router = useRouter();
  const checkoutState = useCheckoutElements();

  async function submitPayment(
    expressCheckoutConfirmEvent?: StripeExpressCheckoutElementConfirmEvent,
  ) {
    if (checkoutState.type !== 'success') {
      expressCheckoutConfirmEvent?.paymentFailed({
        message: 'Maksulomake ei ole vielä valmis. Yritä uudelleen.',
      });
      return;
    }
    const { checkout } = checkoutState;
    onError(null);
    onLoading(true);
    try {
      const result = await checkout.confirm({
        redirect: 'if_required',
        ...(expressCheckoutConfirmEvent ? { expressCheckoutConfirmEvent } : {}),
      });
      if (result.type === 'error') {
        expressCheckoutConfirmEvent?.paymentFailed({ message: result.error.message });
        onError(result.error.message ?? 'Maksu epäonnistui. Tarkista maksutiedot.');
      } else {
        cartStore.clear();
        router.push(`/success?session_id=${encodeURIComponent(result.session.id)}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Maksu epäonnistui.';
      expressCheckoutConfirmEvent?.paymentFailed({ message });
      onError(message);
    } finally {
      onLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <ExpressCheckoutElement
        options={{
          buttonHeight: 48,
          buttonType: { applePay: 'buy', googlePay: 'buy' },
          buttonTheme: { applePay: 'black', googlePay: 'black' },
          layout: { maxColumns: 2, maxRows: 1 },
          paymentMethodOrder: ['apple_pay', 'google_pay'],
          paymentMethods: { applePay: 'always', googlePay: 'always' },
        }}
        onConfirm={submitPayment}
      />
      <PaymentElement />
      <Button
        variant="cta"
        size="lg"
        className="w-full"
        disabled={loading || checkoutState.type !== 'success'}
        onClick={() => void submitPayment()}
      >
        {loading ? <LoadingPill className="bg-current/25" /> : 'Maksa turvallisesti'}
      </Button>
    </div>
  );
}
