ALTER TABLE "ItemVariant" ALTER COLUMN "name" DROP NOT NULL;

-- Every item gets one unnamed price option when it has no variants yet.
INSERT INTO "ItemVariant" ("id", "itemId", "name", "priceCents", "sortOrder", "active")
SELECT 'legacy-' || "id", "id", NULL, "priceCents", 0, true
FROM "Item" item
WHERE NOT EXISTS (
  SELECT 1 FROM "ItemVariant" variant WHERE variant."itemId" = item."id"
);

-- A single option is the product price and does not need a displayed name.
UPDATE "ItemVariant" variant
SET "name" = NULL
WHERE (
  SELECT COUNT(*) FROM "ItemVariant" same_item WHERE same_item."itemId" = variant."itemId"
) = 1;

-- Keep the legacy catalog price compatible with the first priced option.
UPDATE "Item" item
SET "priceCents" = prices."priceCents"
FROM (
  SELECT DISTINCT ON ("itemId") "itemId", "priceCents"
  FROM "ItemVariant"
  WHERE "active" = true
  ORDER BY "itemId", "sortOrder", "id"
) prices
WHERE prices."itemId" = item."id";
