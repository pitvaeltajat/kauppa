-- Kammi (cabin) booking: a single-cabin rental flow.
-- btree_gist lets a gist exclusion constraint mix the daterange (&&) with an
-- equality column if we ever need one; it is also the extension that provides
-- the range operator class used below.
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');
CREATE TYPE "KammiTier" AS ENUM ('SCOUT', 'OTHER');

CREATE TABLE "KammiBooking" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "nights" INTEGER NOT NULL,
    "tier" "KammiTier" NOT NULL DEFAULT 'OTHER',
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "email" TEXT,
    "name" TEXT,
    "phone" TEXT,
    "totalCents" INTEGER NOT NULL,
    "stripeSessionId" TEXT,
    "holdExpiresAt" TIMESTAMP(3),
    "googleEventId" TEXT,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "KammiBooking_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KammiBooking_stripeSessionId_key" ON "KammiBooking"("stripeSessionId");
CREATE INDEX "KammiBooking_status_startDate_idx" ON "KammiBooking"("status", "startDate");

-- The core invariant: no two live (non-cancelled) bookings may overlap on the
-- half-open range [startDate, endDate). The database refuses the second
-- overlapping insert/update, which is the race-proof guarantee that two people
-- can never both hold or confirm the same nights.
ALTER TABLE "KammiBooking"
    ADD CONSTRAINT "KammiBooking_no_overlap"
    EXCLUDE USING gist (daterange("startDate", "endDate", '[)') WITH &&)
    WHERE ("status" <> 'CANCELLED');

CREATE TABLE "KammiSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "weekendScoutCents" INTEGER NOT NULL DEFAULT 20000,
    "weekendOtherCents" INTEGER NOT NULL DEFAULT 30000,
    "weekdayScoutCents" INTEGER NOT NULL DEFAULT 5000,
    "weekdayOtherCents" INTEGER NOT NULL DEFAULT 10000,
    "minNights" INTEGER NOT NULL DEFAULT 1,
    "maxNights" INTEGER NOT NULL DEFAULT 14,
    "keycode" TEXT NOT NULL DEFAULT '',
    "instructions" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "KammiSettings_pkey" PRIMARY KEY ("id")
);

-- Seed the single settings row so the app can always read/update it.
INSERT INTO "KammiSettings" ("id", "updatedAt") VALUES ('singleton', CURRENT_TIMESTAMP)
    ON CONFLICT ("id") DO NOTHING;
