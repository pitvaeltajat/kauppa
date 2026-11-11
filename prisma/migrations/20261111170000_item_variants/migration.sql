CREATE TABLE "ItemVariant" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "ItemVariant_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "OrderLine" ADD COLUMN "variantId" TEXT;
ALTER TABLE "OrderLine" ADD COLUMN "variantName" TEXT;

CREATE INDEX "ItemVariant_itemId_sortOrder_idx" ON "ItemVariant"("itemId", "sortOrder");
ALTER TABLE "ItemVariant" ADD CONSTRAINT "ItemVariant_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ItemVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
