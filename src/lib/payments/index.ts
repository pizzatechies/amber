import "server-only";
import { env } from "@/lib/env";
import { sandboxProvider } from "./sandbox";
import { stripeProvider } from "./stripe";
import type { PaymentProvider } from "./types";

export type { PaymentProvider, CheckoutOrder, PaymentState } from "./types";

const providers: Record<string, PaymentProvider> = {
  sandbox: sandboxProvider,
  stripe: stripeProvider,
};

/** The gateway selected by PAYMENT_PROVIDER. */
export function payments(): PaymentProvider {
  return providers[env().PAYMENT_PROVIDER]!;
}

/** The gateway that took a given order (it may differ from the current setting). */
export function providerFor(id: string): PaymentProvider | null {
  return providers[id] ?? null;
}
