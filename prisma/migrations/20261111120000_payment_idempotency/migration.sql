ALTER TABLE "Order" ADD COLUMN "checkoutKey" TEXT;
CREATE UNIQUE INDEX "Order_checkoutKey_key" ON "Order"("checkoutKey");

ALTER TABLE "KammiBooking" ADD COLUMN "requestKey" TEXT;
CREATE UNIQUE INDEX "KammiBooking_requestKey_key" ON "KammiBooking"("requestKey");
