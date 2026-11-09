# AGENTS.md

See `CLAUDE.md` for the full conventions. The short version:

- **UI in Finnish, code in English.**
- Run `pnpm type-check`, `pnpm lint` and `pnpm test` before finishing; build
  with `pnpm build` when touching pages/routes.
- Money is integer cents; format with `lib/money.ts`.
- Cart state lives in `lib/cart.ts` (ids + quantities only); DB is always the
  source of truth for prices/stock.
- Server actions called from plain forms take one arg (`FormData`); server
  actions in `useActionState` take `(prev, formData)` and return `ActionResult`.
- Admin authorization is a database `User` row with role `ADMIN`, set under
  /admin/users (bootstrap: `KAUPPA_BOOTSTRAP_ADMIN_EMAILS` + `pnpm db:seed`,
  or `pnpm db:admin <email>`). Enforced in the layout and every server action.
- Items can carry checkout questions (TEXT/NUMBER/RADIO/CHECKBOX); answers are
  validated in `lib/questions.ts` and snapshotted onto the order line.
- Theme tokens live in `styles/globals.css`; keep them in sync with
  Klapi/Budu/landeri.

## Production database

- Production runs on the Lightsail instance `pitva-debian-13`, not AWS RDS or a
  managed Vercel database.
- Resolve the current host instead of hard-coding its public IP:
  `aws lightsail get-instances --query 'instances[?name==\`pitva-debian-13\`].publicIpAddress' --output text`.
- SSH with the existing local key `~/.ssh/lightsail-pitva` as user `admin`.
- The Docker Compose project is `/home/admin/docker/pitva`; the Postgres
  container is `pitva-postgres`, and Kontti's database is `kauppa`.
- For read-only SQL, pipe SQL into the container and let the container expand
  `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB`; never print or copy
  those values. Example:
  `printf '%s\n' 'SELECT ...;' | ssh -i ~/.ssh/lightsail-pitva -o IdentitiesOnly=yes admin@<ip> "sudo docker exec -i pitva-postgres sh -c 'PGPASSWORD=\"\$POSTGRES_PASSWORD\" psql -U \"\$POSTGRES_USER\" -d kauppa -At'"`.
- Production writes require explicit user authorization, a narrowly scoped SQL
  statement, and a read-back verification. Remove any temporary SSH key files
  created during access.

## Delivery

- After making changes, commit them and push to the remote `main` branch once
  validation passes. Never force-push; if the push cannot be completed safely,
  report the blocker instead.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes. APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev`. Verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
