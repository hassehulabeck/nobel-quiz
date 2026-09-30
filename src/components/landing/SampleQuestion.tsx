"use client";

import { useState } from "react";

type SampleOption = { label: string; count: number };

/**
 * A try-it-out teaser of a real question. Nothing is saved or sent: picking
 * an option just reveals the points it would be worth, so a visitor sees the
 * "rarer outcome, bigger score" idea before signing up.
 */
export function SampleQuestion({
  prizeName,
  text,
  total,
  options,
}: {
  prizeName: string;
  text: string;
  total: number;
  options: SampleOption[];
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const chosen = picked === null ? null : options[picked];

  return (
    <div className="rounded-lg border border-border border-t-4 border-t-[var(--color-teal)] bg-surface p-5 text-left shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Sample question · {prizeName}
      </p>
      <fieldset className="mt-2 flex flex-col gap-2">
        <legend className="text-lg font-medium">{text}</legend>
        {options.map((option, i) => (
          <label
            key={option.label}
            className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 ${
              picked === i
                ? "border-border bg-teal-tint text-teal-tint-foreground"
                : "border-border bg-surface"
            }`}
          >
            <input
              type="radio"
              name="sample-answer"
              checked={picked === i}
              onChange={() => setPicked(i)}
              className="h-4 w-4 accent-primary"
            />
            <span>{option.label}</span>
          </label>
        ))}
      </fieldset>
      <p
        role="status"
        className="mt-3 rounded-md bg-teal-tint px-3 py-2 text-sm text-teal-tint-foreground"
      >
        {chosen
          ? `${chosen.label} has happened in ${chosen.count} of the last ${total} years, so it's worth ${(total / chosen.count).toFixed(2)} points if you're right. Sign up to play for real.`
          : "Pick an answer to see what it would score."}
      </p>
    </div>
  );
}
