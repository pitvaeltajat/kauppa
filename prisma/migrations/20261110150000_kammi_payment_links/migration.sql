ALTER TABLE "KammiBooking" ADD COLUMN "paymentToken" TEXT;

CREATE UNIQUE INDEX "KammiBooking_paymentToken_key" ON "KammiBooking"("paymentToken");
