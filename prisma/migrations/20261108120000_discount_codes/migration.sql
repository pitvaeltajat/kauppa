-- Leaders' discount opt-in on events + general discount codes.
ALTER TABLE "Item" ADD COLUMN "leaderDiscount" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "DiscountCode" (
    "id"          TEXT NOT NULL,
    "code"        TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "percentOff"  INTEGER NOT NULL,
    "leaderOnly"  BOOLEAN NOT NULL DEFAULT false,
    "active"      BOOLEAN NOT NULL DEFAULT true,
    "validUntil"  TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscountCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DiscountCode_code_key" ON "DiscountCode"("code");
