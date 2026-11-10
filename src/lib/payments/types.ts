export type CheckoutOrder = {
  id: string;
  number: number;
  totalCents: number;
  currency: string;
  buyerEmail: string;
  items: Array<{ title: string; priceCents: number }>;
};

export type PaymentState = "paid" | "pending" | "failed";

/**
 * A payment gateway. To add one (PayPal, Paystack, Flutterwave, a mobile-money
 * provider, ...), implement this interface, register it in ./index.ts and add
 * its id to PAYMENT_PROVIDER in src/lib/env.ts. Nothing else in the app needs
 * to know which gateway is in use.
 */
export interface PaymentProvider {
  readonly id: string;
  /** True when no real money moves. The UI says so prominently. */
  readonly isTestMode: boolean;

  /** Begin payment. Returns where to send the buyer and the gateway's reference for the order. */
  startCheckout(order: CheckoutOrder): Promise<{ redirectUrl: string; providerRef: string }>;
  /** Ask the gateway whether an order has been paid. Used when the buyer returns from checkout. */
  confirm(order: { id: string; providerRef: string; totalCents: number; currency: string }): Promise<PaymentState>;
  /** Abandon an unpaid checkout so it can no longer be completed. Best effort. */
  cancel(order: { providerRef: string }): Promise<void>;
  /** Return the buyer's money for a paid order. Throws if the gateway refuses. */
  refund(order: { id: string; providerRef: string; totalCents: number }): Promise<void>;
}
