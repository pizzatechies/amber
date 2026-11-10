import type { PaymentProvider } from "./types";

/**
 * Stand-in gateway for development and demos. Instead of a real payment page,
 * the buyer lands on /checkout/sandbox/[orderId] and chooses whether the
 * simulated payment succeeds or is declined. It never moves real money.
 */
export const sandboxProvider: PaymentProvider = {
  id: "sandbox",
  isTestMode: true,

  async startCheckout(order) {
    return { redirectUrl: `/checkout/sandbox/${order.id}`, providerRef: `sandbox_${order.id}` };
  },

  // The sandbox page fulfils the order itself, so there is nothing to look up.
  async confirm() {
    return "pending";
  },

  async cancel() {},

  async refund() {},
};
