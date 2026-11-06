-- Bootstrap the initial superadmins so sign-in works while the shop is "kesken"
-- (lib/auth.ts admits only SUPERADMIN). Applied by `prisma migrate deploy`
-- during the Vercel build, with the production DATABASE_URL in the env — the
-- reliable path when direct DB access isn't available.
--
-- Idempotent: upserts by email and clears any soft-delete, so a re-run or an
-- already-present row converges to the same state. A one-shot bootstrap only —
-- further superadmins are named by a superadmin in /admin/users.
INSERT INTO "User" (id, email, role, "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'petrus@pitkajarvenvaeltajat.fi', 'SUPERADMIN'::"Role", now(), now()),
  (gen_random_uuid()::text, 'eero@pitkajarvenvaeltajat.fi', 'SUPERADMIN'::"Role", now(), now())
ON CONFLICT (email) DO UPDATE
  SET role = 'SUPERADMIN'::"Role", "deletedAt" = NULL, "updatedAt" = now();
