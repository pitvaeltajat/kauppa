ALTER TABLE "Order"
    ADD COLUMN "stripeCustomerId" TEXT,
    ADD COLUMN "stripeInvoiceId" TEXT,
    ADD COLUMN "invoiceUrl" TEXT,
    ADD COLUMN "invoicePdfUrl" TEXT,
    ADD COLUMN "invoiceDueAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Order_stripeInvoiceId_key" ON "Order"("stripeInvoiceId");
