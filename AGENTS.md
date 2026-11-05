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
- Admin authorization is enforced in the server action / layout, never only in
  the UI.
- Theme tokens live in `styles/globals.css`; keep them in sync with
  Klapi/Budu/landeri.
