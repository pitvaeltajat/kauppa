-- Only the built-in JOHTAJA code is scoped to leader-discount events.
UPDATE "DiscountCode"
SET "leaderOnly" = CASE WHEN "code" = 'JOHTAJA' THEN true ELSE false END;
