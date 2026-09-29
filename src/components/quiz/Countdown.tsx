"use client";

import { useEffect, useState } from "react";

function formatRemaining(ms: number): string {
  if (ms <= 0) return "Closed";
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  if (minutes > 0) return `${minutes}m ${seconds}s remaining`;
  return `${seconds}s remaining`;
}

export function Countdown({ deadline }: { deadline: string }) {
  const target = new Date(deadline);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Server-rendered markup can't know the visitor's clock, so render
  // nothing dynamic until the client has mounted and ticked once.
  if (now === null) return null;

  return (
    <p className="text-sm text-muted-foreground" aria-live="off">
      {formatRemaining(target.getTime() - now)} · closes{" "}
      {target.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })}
    </p>
  );
}
