import { computePoints } from "@/lib/scoring";

// Worked example straight from the game's brief: 1 laureate in 4 of the last
// 20 years. Computed, not typed, so the text can't drift from the real formula.
const EXAMPLE_COUNT = 4;
const EXAMPLE_TOTAL = 20;
const EXAMPLE_POINTS = computePoints(EXAMPLE_COUNT, EXAMPLE_TOTAL);

/** The rules text. Server component; wrapped by the collapsible RulesPanel. */
export function RulesContent() {
  return (
    <>
      <p>
        Guess how Nobel prize week 2026 will turn out. Each prize day has a
        couple of questions about that prize, and there are a few whole-week
        questions too. Pick one answer per question.
      </p>

      <section className="flex flex-col gap-1">
        <h3 className="font-semibold">Points come from the odds</h3>
        <p>
          Every answer is worth <strong>1 ÷ how often it has happened</strong>,
          counted over the 20 Nobel years 2006–2025 (facts from nobelprize.org).
          Say a prize had a single laureate in {EXAMPLE_COUNT} of those{" "}
          {EXAMPLE_TOTAL} years: picking &ldquo;1 laureate&rdquo; is worth 1 ÷ (
          {EXAMPLE_COUNT}/{EXAMPLE_TOTAL}) = {EXAMPLE_POINTS} points. Common
          outcomes pay a little, surprising ones pay a lot. The points for each
          answer are shown next to it. A wrong answer, or no answer, scores 0.
        </p>
      </section>

      <section className="flex flex-col gap-1">
        <h3 className="font-semibold">Deadlines</h3>
        <p>
          A prize&apos;s questions close when that prize is announced; the
          whole-week questions close together with the Physics announcement.
          Until then you can change your answers as often as you like. Each
          question shows its own countdown, and after the deadline your answer
          is locked.
        </p>
      </section>

      <section className="flex flex-col gap-1">
        <h3 className="font-semibold">Results</h3>
        <p>
          After an announcement the game collects the result from nobelprize.org
          and the game admin checks it before it counts. Until then you&apos;ll
          see &ldquo;Voting closed. Waiting for the result.&rdquo; Once
          it&apos;s confirmed you see the correct answer, your answer and your
          points. If none of the answers turns out to be right, everyone gets 1
          point for that question.
        </p>
      </section>

      <section className="flex flex-col gap-1">
        <h3 className="font-semibold">Leaderboard and privacy</h3>
        <p>
          The top ten players are ranked by total points, with today&apos;s
          points alongside (a day runs on Stockholm time), and you always see
          your own place. Other players only ever see your display name and
          points, never your email or your answers. You can change your name
          under &ldquo;Change name&rdquo;.
        </p>
      </section>

      <section className="flex flex-col gap-1">
        <h3 className="font-semibold">The finish</h3>
        <p>
          A day after the last prize (Economic Sciences) is confirmed, this page
          turns into the final ranking. You&apos;ll still see your own answers
          and results. Then it&apos;s time to come back next year.
        </p>
      </section>
    </>
  );
}
