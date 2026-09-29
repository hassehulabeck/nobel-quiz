"use client";

import { useState, type ReactNode } from "react";
import { RULES_HIDDEN_COOKIE } from "@/lib/quiz/rulesCookie";

/**
 * Collapsible "how the game works" panel. A native <details>/<summary>, so it
 * is keyboard- and screen-reader-operable without extra ARIA. The open/closed
 * choice is kept in a cookie (read on the server in the page) rather than
 * localStorage, so a player who hid it doesn't see it flash open on each load.
 */
export function RulesPanel({
  defaultOpen,
  children,
}: {
  defaultOpen: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <details
      open={open}
      onToggle={(event) => {
        const nowOpen = event.currentTarget.open;
        setOpen(nowOpen);
        document.cookie = `${RULES_HIDDEN_COOKIE}=${nowOpen ? "0" : "1"}; path=/; max-age=31536000; samesite=lax`;
      }}
      className="card bg-warning-tint text-warning-tint-foreground"
    >
      <summary className="cursor-pointer font-display text-lg font-semibold text-heading">
        How the game works
      </summary>
      <div className="mt-3 flex flex-col gap-3">{children}</div>
    </details>
  );
}
