const DAYS = [
  { date: "Mon 5 Oct", prize: "Physiology or Medicine", by: "Nobel Assembly at Karolinska Institutet", color: "#b8452a" },
  { date: "Tue 6 Oct", prize: "Physics", by: "Royal Swedish Academy of Sciences", color: "#1c2f52" },
  { date: "Wed 7 Oct", prize: "Chemistry", by: "Royal Swedish Academy of Sciences", color: "#1f6f78" },
  { date: "Thu 8 Oct", prize: "Literature", by: "The Swedish Academy", color: "#5b4a96" },
  { date: "Fri 9 Oct", prize: "Peace", by: "Norwegian Nobel Committee (Oslo)", color: "#3f6b43" },
  { date: "Mon 12 Oct", prize: "Economic Sciences", by: "Royal Swedish Academy of Sciences", color: "#a6620a" },
];

/** "The prize week" blurb plus the six announcement days. Server component. */
export function PrizeWeek() {
  return (
    <section className="flex flex-col gap-4 text-left">
      <h2 className="text-2xl font-semibold">The prize week</h2>
      <p>
        Every October the Nobel Prizes are announced over a few days, one prize
        at a time. The Nobel Foundation in Stockholm looks after the prizes; the
        winners are chosen by Swedish institutions, and by a committee in Oslo
        for the Peace Prize. The laureates then receive their medals on 10
        December, the anniversary of Alfred Nobel&apos;s death.
      </p>
      <ol className="grid gap-3 sm:grid-cols-2">
        {DAYS.map((day) => (
          <li
            key={day.prize}
            className="rounded-lg border border-border bg-surface p-3"
            style={{ borderLeft: `6px solid ${day.color}` }}
          >
            <p className="text-sm font-semibold text-muted-foreground">
              {day.date}
            </p>
            <p className="font-display text-lg font-semibold text-heading">
              {day.prize}
            </p>
            <p className="text-sm">{day.by}</p>
          </li>
        ))}
      </ol>
      <p className="text-sm text-muted-foreground">
        Announcement dates are the earliest ones published by nobelprize.org for
        2026. Times are shown in your own timezone once you&apos;re in the game.
      </p>
    </section>
  );
}
