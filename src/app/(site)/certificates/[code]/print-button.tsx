"use client";

import { useState } from "react";
import { Check, Link2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton() {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2500);
          } catch {
            // Clipboard access can be denied; the address bar still has the link.
          }
        }}
      >
        {copied ? <Check aria-hidden /> : <Link2 aria-hidden />}
        {copied ? "Link copied" : "Copy link"}
      </Button>
      <Button onClick={() => window.print()}>
        <Printer aria-hidden /> Print or save as PDF
      </Button>
    </div>
  );
}
