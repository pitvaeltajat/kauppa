INSERT INTO "AccountingClass" ("id", "name", "sortOrder", "createdAt", "updatedAt")
VALUES ('income-retkituotot', 'Retkituotot', 40, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

UPDATE "Item"
SET "accountingClassId" = (
  SELECT "id" FROM "AccountingClass" WHERE "name" = 'Retkituotot'
)
WHERE "isEvent" = true AND "accountingClassId" IS NULL;
