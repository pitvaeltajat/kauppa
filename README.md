# kontti: Pitkäjärven Vaeltajien verkkokauppa

Own web store for partiolippukunta Pitkäjärven Vaeltajat, replacing
holvi.pitva.fi. Product catalog, events and Kammi bookings live in Postgres,
payments run through Stripe Checkout, and the same Google Workspace sign-in
used by Klapi, Budu and landeri protects the admin side.

UI: **suomi**. Code, commits and comments: **englanti**.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript, pnpm
- Prisma + PostgreSQL (catalog + orders)
- Auth.js (next-auth v5 beta) with Google OAuth, optional shared `.pitva.fi`
  session cookie (same pattern as Klapi/Budu/landeri)
- Stripe Payment Element + webhook, currently in **test/sandbox mode**
- Tailwind CSS v4 with the PitVa brand palette copied from Klapi's
  `styles/globals.css` (navy `#221E5D`, light blue `#BBD1FB`, wash `#ECF2FE`)
- Vitest for the pure logic (money, slugs, checkout validation, stock)
- Deployed to Vercel; proposed domain `kontti.pitva.fi`

## Local development

```bash
docker compose up -d postgres        # Postgres on localhost:5437
cp .env.example .env.local           # then fill in what you have (see below)

pnpm install
pnpm prisma migrate dev              # create schema + migrations
pnpm db:seed                         # seed the 3 categories + catalog
pnpm dev                             # http://localhost:3000
```

`.env` holds the same `DATABASE_URL` as `.env.local`. The Prisma CLI and the
seed script read only `.env`.

### Signing in locally

Two options:

1. **Google OAuth**: set `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`
   (`AUTH_GOOGLE_*` or the Klapi-compatible `GOOGLE_CLIENT_*` names).
2. **Dev login**: with `KAUPPA_DEV_LOGIN=1` (`.env.local` ships with it) the
   `/login` page additionally offers a password-less sign-in with any
   `@example.com` address. It is ignored whenever `NODE_ENV` is `production`.

**Admin roles live in the database.** Signing in creates a `User` row with
role `USER` automatically. PitVa-domain members receive `EVENT_ADMIN` access
for event management; `SUPERADMIN` is the full admin role for products, orders,
settings and users. Roles are managed under **Hallinta → Käyttäjät**. Bootstrap
the first superadmin with either

```bash
KAUPPA_BOOTSTRAP_ADMIN_EMAILS="nimi@pitkajarvenvaeltajat.fi" pnpm db:seed
# or
pnpm db:admin nimi@pitkajarvenvaeltajat.fi
```

`GOOGLE_WORKSPACE_DOMAIN` always restricts Google sign-in to that Workspace
domain. It grants no admin rights by itself. Among domain accounts, only
existing, active `SUPERADMIN` rows may sign in while the shop is restricted.

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

| Command                        | What it does                                                         |
| ------------------------------ | -------------------------------------------------------------------- |
| `pnpm dev`                     | Start the dev server                                                 |
| `pnpm build`                   | `prisma generate` + `prisma migrate deploy` + production build       |
| `pnpm start`                   | Serve the production build                                           |
| `pnpm type-check`              | `tsc --noEmit`                                                       |
| `pnpm lint`                    | ESLint (flat config)                                                 |
| `pnpm test`                    | Vitest unit tests                                                    |
| `pnpm format` / `format:check` | Prettier                                                             |
| `pnpm db:migrate`              | `prisma migrate dev`                                                 |
| `pnpm db:deploy`               | `prisma migrate deploy` (used on Vercel)                             |
| `pnpm db:seed`                 | Upsert the seed catalog + questions (`prisma/seed.ts`)               |
| `pnpm db:admin <email>`        | Make a user a SUPERADMIN (or `KAUPPA_BOOTSTRAP_ADMIN_EMAILS` + seed) |

## Deploying (Vercel)

Pushes to `main` deploy through Vercel. Environment variables to set on the
project:

- `DATABASE_URL`: Postgres connection string (the team already runs Postgres;
  Neon is a drop-in if a new one is wanted)
- `AUTH_SECRET`: `openssl rand -base64 32`
- `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`: copy from Klapi/Budu's Google OAuth
  console entry, or its own
- `GOOGLE_WORKSPACE_DOMAIN="pitkajarvenvaeltajat.fi"`
- `STRIPE_SECRET_KEY`: `sk_test_…` now, `sk_live_…` when the account leaves
  sandbox
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: the Stripe publishable key used by the
  embedded Payment Element
- `STRIPE_WEBHOOK_SECRET`: from Dashboard → Developers → Webhooks (register
  `https://kontti.pitva.fi/api/webhooks/stripe`, events
  `checkout.session.completed`, `checkout.session.expired`,
  `payment_intent.succeeded`, and `invoice.paid`)
- `KAMMI_CALENDAR_ID`: optional Google Calendar ID used for Kammi availability
- `KAMMI_CALENDAR_WRITE_ENABLED="true"`: explicitly enable writing new Kammi
  bookings to that calendar; leave unset or `false` while testing
- `NEXT_PUBLIC_APP_URL="https://kontti.pitva.fi"`: the app's public URL

DNS: `kontti.pitva.fi` CNAME to the Vercel deployment, in the same Route 53
hosted zone that points `kompassi.pitva.fi` and `klapi.pitva.fi`.

### Google Workspace user sync (optional)

`/api/cron/syncWorkspaceUsers` runs nightly (see `vercel.json`) and reconciles
kontti's users against the troop's Google Workspace roster:

- a member of the Workspace group with no kontti row **gets one** (role
  `EVENT_ADMIN`, the same a pitva-domain sign-in grants), so the whole troop
  shows in `/admin/users` with names before anyone has logged in;
- a name that changed in the directory **is refreshed**;
- someone deleted, suspended, archived, or removed from the group **is
  soft-deleted**. `deletedAt` is stamped and `lib/auth.ts` refuses their
  sign-in, even though their pitva-domain address would otherwise still derive
  EVENT_ADMIN. Their row and any manual role survive;
- someone who comes back **is restored**, but only if the sync was the one that
  deactivated them (`User.deletedBySync`). A user an admin deleted by hand
  stays deleted.

Three guards fence the destructive half: an empty active roster aborts the run
(HTTP 409), a run that would deactivate more than `WORKSPACE_SYNC_MAX_DEACTIVATIONS`
accounts (default 10) aborts before writing anything, and the last live
SUPERADMIN is never deactivated.

**Setup** reuses klapi's `klapi-workspace-sync` service account, so the
domain-wide delegation is already in place. Set on the Vercel project:

- `GOOGLE_WORKSPACE_SA_KEY`: base64 of the SA JSON key (copy from klapi)
- `GOOGLE_WORKSPACE_SUBJECT`: a Workspace admin to impersonate (copy from klapi)
- `GOOGLE_WORKSPACE_GROUP`: `jasenet@pitkajarvenvaeltajat.fi`
- `GOOGLE_WORKSPACE_EXCLUDE`: robot accounts to never provision (e.g. `admin@…`)
- `CRON_SECRET`: `openssl rand -base64 32`; Vercel Cron sends it as the
  `Authorization: Bearer` header and the route rejects anything else

Dry run (writes nothing):

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://kontti.pitva.fi/api/cron/syncWorkspaceUsers?dryRun=1"
```

A `unauthorized_client` error from the token exchange means the SA's client id
is missing the two `admin.directory.*.readonly` scopes in Admin console →
Security → API controls → Domain-wide delegation.

To share the session cookie with the other services later, set
`AUTH_COOKIE_DOMAIN=".pitva.fi"` and make `AUTH_SECRET` equal the others'.

## More

- Architecture and data model: `ARCHITECTURE.md`
- Development conventions for AI agents: `CLAUDE.md` / `AGENTS.md`
