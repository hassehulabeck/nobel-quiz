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
