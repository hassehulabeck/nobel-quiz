const stockholmDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Stockholm",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "Today" for the game is defined in Stockholm's calendar day, matching the announcement times (see METHODS.md). */
export function isSameStockholmDay(a: Date, b: Date): boolean {
  return stockholmDateFormatter.format(a) === stockholmDateFormatter.format(b);
}

const stockholmDayLabelFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Stockholm",
  weekday: "long",
  day: "numeric",
  month: "long",
});

/** e.g. "Monday 5 October" — the announcement's calendar day in Stockholm. */
export function formatStockholmDay(date: Date): string {
  return stockholmDayLabelFormatter.format(date).replace(",", "");
}
