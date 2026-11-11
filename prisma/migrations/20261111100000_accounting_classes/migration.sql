CREATE TABLE "AccountingClass" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountingClass_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AccountingClass_name_key" ON "AccountingClass"("name");
CREATE INDEX "AccountingClass_sortOrder_name_idx" ON "AccountingClass"("sortOrder", "name");

ALTER TABLE "Item" ADD COLUMN "accountingClassId" TEXT;

CREATE INDEX "Item_accountingClassId_idx" ON "Item"("accountingClassId");

ALTER TABLE "Item" ADD CONSTRAINT "Item_accountingClassId_fkey"
  FOREIGN KEY ("accountingClassId") REFERENCES "AccountingClass"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
