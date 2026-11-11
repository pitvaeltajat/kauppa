ALTER TABLE "KammiBooking" ADD COLUMN "accountingClassId" TEXT;

CREATE INDEX "KammiBooking_accountingClassId_idx" ON "KammiBooking"("accountingClassId");

ALTER TABLE "KammiBooking" ADD CONSTRAINT "KammiBooking_accountingClassId_fkey"
  FOREIGN KEY ("accountingClassId") REFERENCES "AccountingClass"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
