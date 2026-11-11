ALTER TABLE "Order" ADD COLUMN "invoiceAccessToken" TEXT;
CREATE UNIQUE INDEX "Order_invoiceAccessToken_key" ON "Order"("invoiceAccessToken");
