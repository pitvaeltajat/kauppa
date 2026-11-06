-- Soft-delete for the Workspace user sync: a departed member is deactivated
-- (not removed), losing sign-in while their row and any name/role survive.
ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "deletedBySync" BOOLEAN NOT NULL DEFAULT false;
