INSERT INTO "AccountingClass" ("id", "name", "sortOrder", "createdAt", "updatedAt")
VALUES ('income-3500', '3500 — Kammin vuokratuotot', 50, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE
SET "name" = EXCLUDED."name", "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = CURRENT_TIMESTAMP;

UPDATE "KammiBooking"
SET "accountingClassId" = 'income-3500'
WHERE "accountingClassId" IS DISTINCT FROM 'income-3500';
