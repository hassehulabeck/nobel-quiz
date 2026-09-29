/**
 * Runs once when the Next.js server process starts (see METHODS.md's
 * "in-process scheduler" decision). Phase 0.4 proved a no-op heartbeat
 * survives on Railway's always-on process; this now ticks the real Phase 6
 * scrape/grade scheduler every minute. The tick interval is deliberately
 * more frequent than the actual per-question retry interval
 * (`RETRY_INTERVAL_MS` in scheduler.ts) — the tick just checks what's due,
 * `shouldAttempt` does the real throttling.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { runSchedulerTick } = await import("@/lib/scraping/scheduler");
  const TICK_INTERVAL_MS = 60_000;

  setInterval(() => {
    runSchedulerTick().catch((err) => {
      console.error("[scheduler] tick failed:", err);
    });
  }, TICK_INTERVAL_MS).unref();

  console.log("[scheduler] registered Nobel result scheduler at server startup");
}
