import Stripe from 'stripe';

/**
 * The Stripe client for server-side calls (Checkout Sessions, webhook
 * verification). Test keys (sk_test_) while the account is in sandbox mode.
 */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY ei ole asetettu.');
  }
  return new Stripe(key);
}
