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
- This public repository must not contain production credentials, private
  infrastructure access instructions, or copied worktrees.

## Production database access via AWS CLI

The production PostgreSQL server runs in a Docker container on a Lightsail
instance. Use AWS CLI and SSH for read-only investigation; do not add account
IDs, IP addresses, private-key paths, passwords, or other environment-specific
values to this file.

1. Authenticate with the configured SSO profile:

   ```sh
   aws sso login --profile <profile>
   export AWS_PROFILE=<profile>
   export AWS_DEFAULT_REGION=<region>
   ```

2. Discover the instance instead of hardcoding its address:

   ```sh
   aws lightsail get-instances \
     --query 'instances[].{Name:name,State:state.name,Ip:publicIpAddress}' \
     --output table
   ```

3. Use the approved SSH key and the instance's configured login user. First
   list containers; use `sudo -n docker` because the login user may not be in
   the Docker group:

   ```sh
   ssh -o BatchMode=yes -i <approved-key> <user>@<ip> \
     'sudo -n docker ps --format "table {{.Names}}\\t{{.Image}}\\t{{.Status}}"'
   ```

4. Run read-only SQL inside the PostgreSQL container. Read `POSTGRES_USER`
   and `POSTGRES_DB` inside the container rather than printing their values:

   ```sh
   ssh -o BatchMode=yes -i <approved-key> <user>@<ip> \
     'sudo -n docker exec <postgres-container> sh -c '\''
       psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -P pager=off -c \
       "SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname;"
     '\'''
   ```

   Select the application database only after inspecting its schema. For
   example, a safe Kammi inspection is a `SELECT` of booking status and
   presence flags such as `googleEventId`; never include contact details or
   secrets in command output.

5. For local tooling, an SSH tunnel may be used, but the tunnel must be
   closed after the query:

   ```sh
   ssh -f -N -o ExitOnForwardFailure=yes -i <approved-key> \
     -L <local-port>:127.0.0.1:<remote-port> <user>@<ip>
   ```

Production writes require explicit user authorization, a narrowly scoped
migration or SQL statement, a backup/rollback plan, and a post-change
verification. Never use `DROP`, `TRUNCATE`, bulk `DELETE`, or broad `UPDATE`
against production from an agent.

## Delivery

- After making changes, commit them and push to the remote `main` branch once
  validation passes. Never force-push; if the push cannot be completed safely,
  report the blocker instead.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
