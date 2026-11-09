# Architecture

## Data model (Prisma)

```
Category 1──n Item 1──n OrderLine n──1 Order
```

- **Category**: a shop section (`PitVa-tuotteet`, `Tapahtumat`,
  `Huivit ja merkit`). Fully editable from `/admin/categories`; nothing is
  hardcoded.
- **Item**: one sellable thing. `priceCents` is the single source of truth
  (int cents, no floats). `stock: Int | null`; `null` means unlimited (bundle
  offers, event registrations). `active: false` hides an item from the store
  and the checkout but keeps its order history (admin "Piilota").
- **Order**: one checkout. Status lifecycle:
  `RECEIVED → PAID → COMPLETED | CANCELLED`.
- **OrderLine**: a snapshot of what was bought (`name`, `priceCents`,
  `quantity`). Renaming or deleting an item later never rewrites history.

## Checkout flow

1. The cart lives in the browser (`lib/cart.ts`): ids + quantities in
   localStorage, read through `useSyncExternalStore`. Names, prices and stock
   are never stored there.
2. `POST /api/checkout` re-fetches the items from Postgres and validates every
   line with `buildCheckout` (`lib/checkout.ts`): active item, stock, quantity
   cap, and a total recomputed from DB prices. It creates the `Order`
   (RECEIVED) with its lines, then a Stripe PaymentIntent for the validated
   total. `metadata.orderId` links the two. If creating the intent fails, the
   order row is rolled back.
3. The browser mounts Stripe's localized Payment Element in the cart and
   confirms the PaymentIntent inline. The cart is cleared after confirmation.
4. `POST /api/webhooks/stripe` (signature-verified):
   - `payment_intent.succeeded` (or legacy `checkout.session.completed`) →
     `markOrderPaid`: RECEIVED → PAID, sets
     `paidAt`, `stripePaymentIntent` and backfills available email/name,
     then decrements stock per line (`lib/orders.ts`, floors at 0, leaves
     `null` stock alone). Idempotent (`PAID`/`COMPLETED` orders are skipped).
   - `checkout.session.expired` → cancels a still-RECEIVED order.
5. `payment_intent` on `/success` resolves the order for the thank-you page.
   Stripe emails the receipt; the admin sees the same data under `/admin`.

## Admin

`/admin` is guarded in `app/admin/layout.tsx` by `auth()` + `isAdminUser`
(`lib/admin.ts`), and every server action (`lib/actions/admin.ts`) re-runs the
same check. The UI is never enough.

**Roles live in the database.** Signing in (`lib/auth.ts` jwt callback, only
on an actual sign-in) upserts a `User` row with role `USER`. Only rows with
role `ADMIN` pass the guard. Roles are managed under `/admin/users`
(setUserRole); you cannot demote yourself. The first admin comes from the seed
(`KAUPPA_BOOTSTRAP_ADMIN_EMAILS`) or `pnpm db:admin <email>`.
`GOOGLE_WORKSPACE_DOMAIN` only restricts who can sign in at all. It grants no
admin rights.

Orders: list with status filter, expandable line items (including the buyer's
question answers), and actions that move the status forward (`Merkitse
maksetuksi / luovutetuksi`, `Peruuta`).

Catalog: full CRUD for items and categories. A category can only be deleted
when it is empty; an item is hidden rather than deleted once it exists. Items
carry 0..n checkout questions (TEXT / NUMBER / RADIO / CHECKBOX), edited in the
item form and asked in the cart before payment.

## Checkout questions

A question row exists per item (`ItemQuestion`). At checkout the cart page
renders them (answers kept in the browser with the cart), and
`POST /api/checkout` re-validates every answer against the database using the
pure `validateAndBuildAnswers` in `lib/questions.ts`: text/number questions are
required when flagged, choice questions are always required and answers must
be in the option list. Valid answers are snapshotted onto the order line
(`OrderLine.answers`), so editing or deleting a question later never rewrites
history. The snapshot appears in the admin order view and the success page.

## Design tokens

Copied from Klapi's `styles/globals.css` into `styles/globals.css`, light
theme only: navy `#221E5D` header/`primary`, light blue `#BBD1FB` as the CTA
button, `#ECF2FE` page wash, white cards, warm-gray borders, `#A23936`
destructive, brown/cream warning, muted green for "available/paid" statuses.
If the brand tokens move in the other apps, move them here too.

## Deliberate simplifications (v1)

- No item variants/sizes. The huppari sizes are currently handled by noting
  the size choice at pickup. A future `options` field on Item would carry them.
- No custom email (SES). Stripe sends the receipt; order emails can follow the
  Klapi SES pattern later.
- No product photo upload. `imageUrl` is a URL text field; S3 upload is a
  follow-up.
- `price_data` for Checkout means no Stripe-side product catalog to keep in
  sync; fine until prices are managed outside the app.
- Overbooking is possible: stock is decremented on the paid webhook, not
  reserved at checkout. Acceptable for a scout store.
