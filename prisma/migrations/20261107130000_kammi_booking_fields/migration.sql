-- Fields the old Google Form captured, plus a feedback-sent stamp.
ALTER TABLE "KammiBooking"
    ADD COLUMN "organization" TEXT,
    ADD COLUMN "eventInfo" TEXT,
    ADD COLUMN "hostQuestions" TEXT,
    ADD COLUMN "billingEmail" TEXT,
    ADD COLUMN "feedbackSentAt" TIMESTAMP(3);
