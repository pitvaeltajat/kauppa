ALTER TABLE "KammiSettings" ADD COLUMN "accountingClassId" TEXT;

UPDATE "KammiSettings"
SET "accountingClassId" = 'income-3500'
WHERE "accountingClassId" IS NULL;

ALTER TABLE "KammiSettings" ALTER COLUMN "accountingClassId" SET NOT NULL;

ALTER TABLE "KammiSettings"
  ADD CONSTRAINT "KammiSettings_accountingClassId_fkey"
  FOREIGN KEY ("accountingClassId") REFERENCES "AccountingClass"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

UPDATE "KammiBooking"
SET "accountingClassId" = "KammiSettings"."accountingClassId"
FROM "KammiSettings"
WHERE "KammiSettings"."id" = 'singleton';
