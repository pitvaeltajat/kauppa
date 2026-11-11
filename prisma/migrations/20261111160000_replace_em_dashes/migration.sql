UPDATE "AccountingClass"
SET "name" = REPLACE("name", '—', '-')
WHERE "name" LIKE '%—%';
