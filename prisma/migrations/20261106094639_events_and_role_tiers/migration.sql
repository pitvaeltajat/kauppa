-- Role tiers: USER / EVENT_ADMIN / SUPERADMIN. Existing ADMIN rows become
-- SUPERADMIN (remapped in the USING cast, so the drop of ADMIN does not fail).
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('USER', 'EVENT_ADMIN', 'SUPERADMIN');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING (
  CASE WHEN "role"::text = 'ADMIN' THEN 'SUPERADMIN' ELSE "role"::text END::"Role_new"
);
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'USER';
COMMIT;

-- Events are items: dates + an "unlisted but direct-linkable" flag.
ALTER TABLE "Item"
  ADD COLUMN "isEvent"  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "startsAt" TIMESTAMP(3),
  ADD COLUMN "endsAt"   TIMESTAMP(3),
  ADD COLUMN "hidden"   BOOLEAN NOT NULL DEFAULT false;
