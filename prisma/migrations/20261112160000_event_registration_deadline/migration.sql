ALTER TABLE "Item" ADD COLUMN "registrationDeadline" TIMESTAMP(3);

UPDATE "Item"
SET "registrationDeadline" = "startsAt" - INTERVAL '5 days'
WHERE "isEvent" = true
  AND "startsAt" IS NOT NULL
  AND "registrationDeadline" IS NULL;
