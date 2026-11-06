# Potential features

A backlog of ideas not yet built. Nothing here is committed to — it's a place
to capture direction so it isn't lost. Promote an item to an issue / PR when
it's actually picked up.

## Kammi payment links

**Context.** People book the kammi (the troop's hut) with a Google Form. Today
payment is arranged separately and tracked by hand. We want each booking to come
with its own payment link and a clear paid / unpaid status.

**Idea.** For every booking, mint an individual Stripe payment link for that
booking's amount (nights × rate, or a fixed fee), send it to the booker, and
track whether it's been paid — all visible to admins in one list.

**Shape (rough).**
- A `KammiBooking` row: booker name + email, dates, amount, the Stripe
  payment-link id + url, status (`UNPAID` / `PAID` / `CANCELLED`), created-at.
  Reuse the existing Stripe client (`lib/stripe`) and the Prisma patterns the
  shop already uses.
- Create the link via Stripe **Payment Links** (one-off, per booking) rather
  than a full Checkout session — simplest for a "here's your link" email.
- Mark paid from the Stripe webhook we already run
  (`app/api/webhooks/stripe`) — add a branch that matches the payment link /
  its metadata (`kammiBookingId`) and flips the row to `PAID`.
- Admin screen `/admin/kammi`: list bookings with status, copy-link, and a
  manual "mark paid" / "cancel" for edge cases (cash, refunds).

**Ingesting the form responses (pick one, start manual).**
1. *Manual* — admin reads the Form's response sheet and adds a booking in
   `/admin/kammi`; the link is generated on save. Smallest first step.
2. *Sheet import* — paste / upload the response sheet, create links in bulk.
3. *Automated* — a Google Apps Script on the Form posts each new response to a
   kauppa endpoint (shared secret, like the cron) that creates the booking +
   link and emails it back. Nicest, most moving parts.

**Open questions.** Pricing model (per-night vs flat); who sends the email
(kauppa vs. a human forwarding the link); refunds/cancellations handling;
whether bookings should also appear to the booker (needs them to be a logged-in
user, which the current kesken login wall prevents).
