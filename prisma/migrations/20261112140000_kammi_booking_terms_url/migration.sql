ALTER TABLE "KammiSettings" ADD COLUMN "bookingTermsUrl" TEXT;

UPDATE "KammiSettings"
SET "bookingTermsUrl" = 'https://drive.google.com/file/d/1iF58NT6tCdfWlu9n6qXkiwd1xalC1mdY/view?usp=drive_link'
WHERE "id" = 'singleton';
