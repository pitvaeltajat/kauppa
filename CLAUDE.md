# CLAUDE.md (also applies to other coding agents; AGENTS.md mirrors this)

## Project

A Next.js 16 (App Router) online store for Pitkäjärven Vaeltajat ry. Product
catalog and orders in Postgres (Prisma), payments via Stripe Checkout (test
mode), admin via Auth.js Google sign-in. Runs on Vercel.

## Conventions

- **UI copy and user-facing strings are Finnish**, always. Code identifiers,
  comments, commits and docs are English.
- Brand colors come from `styles/globals.css` (Tailwind v4 `@theme`), copied
  from Klapi/Budu/landeri: `bg-header`, `bg-cta`, `bg-primary`, `text-muted-foreground`.
  If those move upstream, move them here too — the store is the public face.
- Money is **integer cents** everywhere (`priceCents`). Format with
  `formatCents`, parse admin input with `parseEurosInput` (`lib/money.ts`).
- Slugs come from `slugify` (`lib/slug.ts`). Finnish diacritics are stripped.
- The cart is a tiny external store (`lib/cart.ts`, localStorage +
  `useSyncExternalStore`). It holds only ids + quantities; prices/names/stock
  always come from Postgres at render/checkout time.
- `useSyncExternalStore` calls MUST pass a `getServerSnapshot` (return `[]`),
  or SSR 500s.
- NextAuth secrets/URLs: `next start` runs with `NODE_ENV=production`, so a
  local run needs `AUTH_SECRET` set (`.env.local` ships with a dev one) and
  `trustHost` handles localhost via `!process.env.VERCEL`.
- Everything is `dynamic` (App Router) — the build server has no Postgres, so
  pages are never prerendered.

## Commands

```bash
pnpm dev             # dev server (docker compose up -d postgres first)
pnpm type-check      # tsc --noEmit
pnpm lint            # eslint .
pnpm test            # vitest (pure logic only, __tests__/)
pnpm build           # prisma generate && next build
pnpm db:migrate      # prisma migrate dev
pnpm db:seed         # tsx prisma/seed.ts (idempotent upserts)
```

## Key files

- `prisma/schema.prisma`, `prisma/seed.ts` — models + the seeded catalog
- `lib/checkout.ts`, `lib/orders.ts`, `lib/money.ts`, `lib/slug.ts` — pure,
  unit-tested logic (no Prisma imports)
- `lib/auth.ts`, `lib/admin.ts` — sign-in and admin authorization
- `app/api/checkout/route.ts`, `app/api/webhooks/stripe/route.ts` — money in
- `lib/actions/admin.ts` — server actions; every action re-checks the admin
  session itself
- `components/cart-shell.tsx`, `lib/cart.ts` — cart UI and store

## Gotchas

- Server actions used in a plain `<form action={…}>` receive ONLY `FormData`;
  ones used with `useActionState` get `(prev, formData)`. Don't mix the two
  signatures.
- Do not `throw` in server actions for user-facing errors — return
  `{ error }` (ActionResult) and render it.
- The webhook route must read the raw body via `req.text()` before
  `constructEventAsync`.
- Stock: `null` = unlimited. `applyQuantityToStock` floors at 0 and never un-
  nulls. Stock is spent on the paid webhook (RECEIVED → PAID), not at checkout.
- A category with items cannot be deleted; items are hidden (`active: false`)
  rather than hard-deleted once they have order history.

## App identity

This is one of the PitVa services. The header links back to the front door
`atk.pitva.fi` (same pattern as Klapi/Budu/landeri), the footer carries the
troop's contact and website links, and the shared session cookie
(`AUTH_COOKIE_DOMAIN`) is an option once `AUTH_SECRET` is aligned with the
sibling apps.
