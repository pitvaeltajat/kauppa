# kauppa — Pitkäjärven Vaeltajien verkkokauppa

Own web store for partiolippukunta Pitkäjärven Vaeltajat, replacing
holvi.pitva.fi. Product catalog and orders live in Postgres, payments run
through Stripe Checkout, and the same Google Workspace sign-in used by Klapi,
Budu and landeri protects the admin side.

UI: **suomi**. Code, commits and comments: **englanti**.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript, pnpm
- Prisma + PostgreSQL (catalog + orders)
- Auth.js (next-auth v5 beta) with Google OAuth, optional shared `.pitva.fi`
  session cookie (same pattern as Klapi/Budu/landeri)
- Stripe (Checkout Sessions + webhook), currently in **test/sandbox mode**
- Tailwind CSS v4 with the PitVa brand palette copied from Klapi's
  `styles/globals.css` (navy `#221E5D`, light blue `#BBD1FB`, wash `#ECF2FE`)
- Vitest for the pure logic (money, slugs, checkout validation, stock)
- Deployed to Vercel; proposed domain `kauppa.pitva.fi`

## Local development

```bash
docker compose up -d postgres        # Postgres on localhost:5437
cp .env.example .env.local           # then fill in what you have (see below)

pnpm install
pnpm prisma migrate dev              # create schema + migrations
pnpm db:seed                         # seed the 3 categories + catalog
pnpm dev                             # http://localhost:3000
```

`.env` holds the same `DATABASE_URL` as `.env.local` — the Prisma CLI and the
seed script read only `.env`.

### Signing in locally

Two options:

1. **Google OAuth** — set `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`
   (`AUTH_GOOGLE_*` or the Klapi-compatible `GOOGLE_CLIENT_*` names).
2. **Dev login** — with `KAUPPA_DEV_LOGIN=1` (`.env.local` ships with it) the
   `/login` page additionally offers a password-less sign-in with any
   `@example.com` address. It is ignored whenever `NODE_ENV` is `production`.

An email is an admin when it is in `KAUPPA_ADMIN_EMAILS`, or (when that is
empty) it is under `GOOGLE_WORKSPACE_DOMAIN`. With neither set every signed-in
user is an admin — fine locally, do not deploy that way.

### Stripe (test mode)

```bash
# in the Stripe dashboard (test mode): copy the secret key
#   https://dashboard.stripe.com/test/apikeys
#   → set STRIPE_SECRET_KEY (sk_test_...)

# forward webhooks to the app
stripe listen --forward-to localhost:3000/api/webhooks/stripe
#   → set STRIPE_WEBHOOK_SECRET (whsec_...) from the CLI output
```

The webhook marks Orders PAID and decrements stock. Without a live webhook you
can still complete a test payment; the order stays RECEIVED and the admin can
mark it paid manually.

## Scripts

| Command            | What it does                                    |
| ------------------ | ----------------------------------------------- |
| `pnpm dev`         | Start the dev server                            |
| `pnpm build`       | `prisma generate` + production build            |
| `pnpm start`       | Serve the production build                     |
| `pnpm type-check`  | `tsc --noEmit`                                  |
| `pnpm lint`        | ESLint (flat config)                            |
| `pnpm test`        | Vitest unit tests                               |
| `pnpm format` / `format:check` | Prettier             |
| `pnpm db:migrate`  | `prisma migrate dev`                            |
| `pnpm db:deploy`   | `prisma migrate deploy` (used on Vercel)        |
| `pnpm db:seed`     | Upsert the seed catalog (`prisma/seed.ts`)       |

## Deploying (Vercel)

Pushes to `main` deploy through Vercel. Environment variables to set on the
project:

- `DATABASE_URL` — Postgres connection string (the team already runs Postgres;
  Neon is a drop-in if a new one is wanted)
- `AUTH_SECRET` — `openssl rand -base64 32`
- `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` — copy from Klapi/Budu's Google OAuth
  console entry, or its own
- `GOOGLE_WORKSPACE_DOMAIN="pitkajarvenvaeltajat.fi"`
- `STRIPE_SECRET_KEY` — `sk_test_…` now, `sk_live_…` when the account leaves
  sandbox
- `STRIPE_WEBHOOK_SECRET` — from Dashboard → Developers → Webhooks (register
  `https://kauppa.pitva.fi/api/webhooks/stripe`, events
  `checkout.session.completed` and `checkout.session.expired`)
- `NEXT_PUBLIC_APP_URL="https://kauppa.pitva.fi"` — used for the success/cancel
  URLs

DNS: `kauppa.pitva.fi` CNAME to the Vercel deployment, in the same Route 53
hosted zone that points `atk.pitva.fi` and `klapi.pitva.fi`.

To share the session cookie with the other services later, set
`AUTH_COOKIE_DOMAIN=".pitva.fi"` and make `AUTH_SECRET` equal the others'.

## More

- Architecture and data model: `ARCHITECTURE.md`
- Development conventions for AI agents: `CLAUDE.md` / `AGENTS.md`
