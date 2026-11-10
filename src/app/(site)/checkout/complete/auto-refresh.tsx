"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/** Re-checks the order every few seconds while a payment is still pending. */
export function AutoRefresh({ intervalMs = 3000, attempts = 20 }: { intervalMs?: number; attempts?: number }) {
  const router = useRouter();
  const [left, setLeft] = useState(attempts);

  useEffect(() => {
    if (left <= 0) return;
    const timer = window.setTimeout(() => {
      setLeft((n) => n - 1);
      router.refresh();
    }, intervalMs);
    return () => window.clearTimeout(timer);
  }, [left, intervalMs, router]);

  if (left > 0) return null;
  return (
    <div className="mt-6">
      <p className="text-sm text-muted">Still waiting. If you completed the payment, it will appear in your purchase history.</p>
      <Button variant="outline" className="mt-3" onClick={() => setLeft(attempts)}>
        Check again
      </Button>
    </div>
  );
}
