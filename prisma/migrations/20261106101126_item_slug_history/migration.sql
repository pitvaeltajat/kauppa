-- Historic slugs so old /item/<slug> links keep working after a slug edit.
CREATE TABLE "ItemSlug" (
  "slug" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ItemSlug_pkey" PRIMARY KEY ("slug")
);
CREATE INDEX "ItemSlug_itemId_idx" ON "ItemSlug"("itemId");
ALTER TABLE "ItemSlug" ADD CONSTRAINT "ItemSlug_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
