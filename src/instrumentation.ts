/**
 * Runs once when the Next.js server process starts (see METHODS.md's
 * "in-process scheduler" decision). This is currently a no-op heartbeat that
 * proves the interval survives on Railway's always-on process; Phase 6 will
 * replace the interval body with the real per-prize scrape/retry logic.
 */
export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const INTERVAL_MS = 60_000;

  setInterval(() => {
    console.log(`[scheduler] heartbeat at ${new Date().toISOString()}`);
  }, INTERVAL_MS).unref();

  console.log("[scheduler] registered heartbeat interval at server startup");
}
