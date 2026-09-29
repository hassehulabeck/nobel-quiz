# TASKS.md — Project Plan

Status legend: `[ ]` not started · `[~]` in progress · `[x]` done

Tasks are grouped into phases. Within a phase, tasks are written to be as non-blocking as possible — most can be picked up in parallel once the phase's shared prerequisite (usually the Prisma schema) exists. Hard dependencies are called out explicitly under **Depends on**. Every task or tight group of tasks has a **Verify** condition.

---

## Phase 0 — Scaffolding
*No dependencies. Can start immediately.*

- [x] **0.1** Init Next.js (App Router, TypeScript) project — actually Next.js 16.3.6/React 19.2.8, the current stable at build time, not 14; add Tailwind CSS v4; add Prisma 7.10.0; add ESLint + Prettier.
  **Verify:** `npm run dev` serves a blank page at `/` with no console errors (confirmed — `200` from a local curl); `npm run build` succeeds (confirmed, static prerender of `/`). shadcn/ui init deferred to Phase 7 when there's an actual UI to skin.
- [x] **0.2** Add a dedicated Railway project with a Postgres service; wire `PRODUCTION_DATABASE_URL`. A fresh `nobel-quiz` Railway project + Postgres service was created 2026-09-28 (the credentials the user first pasted didn't match their only pre-existing project, `football-coupons` — see METHODS.md), with a TCP proxy enabled for public access (`iriguchi.proxy.rlwy.net:53911`).
  **Verify:** confirmed 2026-09-28 — `SELECT 1` and `SELECT version()` succeeded from a local shell against the Railway Postgres instance (PostgreSQL 18.6); with the user's explicit authorization (this is a real deploy action, correctly flagged and held for confirmation), `prisma migrate deploy` was run against it and all 8 tables + `_prisma_migrations` were confirmed present via `information_schema.tables`. Not yet seeded with 2026 question content — deferred to Phase 9's actual go-live step.
- [x] **0.3** Add Resend API key as an env var; send one test email via a throwaway script.
  **Verify:** confirmed 2026-09-28 — a real test email sent via the Resend API (id `01a0e76b-b27f-759b-9925-f6321b67e2a8`) arrived at an inbox the user controls. Sent from Resend's shared `onboarding@resend.dev` sender rather than the account's custom domain (`mail.hulabeck.se`), whose verification status is "failed" — user chose to proceed with the shared sender for now rather than fix DNS immediately; see METHODS.md.
- [x] **0.4** Set up `instrumentation.ts` scaffold with a no-op interval (proves the "always-on process" assumption holds on Railway before real scraping logic is built on top of it).
  **Verify:** locally confirmed `register()` runs once at `next dev` startup with no errors (log line observed, process stayed up, `/` kept responding). The full "10+ minutes on Railway without restarting" check is inherently a Railway-only check — re-verify once 9.1 deploys.

---

## Phase 1 — Data model
**Depends on:** 0.1

- [x] **1.1** Write the Prisma schema: `User`, `Session`, `VerificationToken`, `PrizeCategory` (the 6 categories), `Question` (with a `scope` of `PRIZE_SPECIFIC` or `WHOLE_WEEK` and its own `answerDeadline`), `AnswerOption` (historical count/total + precomputed `points`), `Submission` (unique per user+question, editable until deadline), `Result` (gated by `approvedAt`, with a `noneMatched` flag for the 2.6 fallback). Scores are computed on read (no `DailyScore`/`TotalScore` tables) per METHODS.md.
  **Verify:** `prisma migrate dev` ran clean (`20260928084411_init` applied to a local scratch DB). A throwaway smoke script created one row per model end-to-end, confirmed the `(userId, questionId)` unique constraint, and confirmed cascade-delete on `User` leaves zero orphaned `Submission` rows (also validates the 8.2 hard-delete decision structurally).
- [x] **1.2** Write the odds/points calculator as a small pure function taking a historical frequency (e.g. `4/20`) and returning `points = 1 / probability`, matching the worked example in instructions.md (4/20 → 5 points).
  **Verify:** `src/lib/scoring.ts` + `src/lib/scoring.test.ts`, `npm test` passing: `computePoints(4, 20) === 5`; `computePoints(0, 20)` and `computePoints(4, 0)` both throw explicitly rather than dividing by zero; `computePoints(21, 20)` throws for an impossible count-exceeds-total case.

---

## Phase 2 — Question content authoring
**Depends on:** 1.1 (schema shape only, not a running DB — can be written as seed data in parallel with Phase 0/3/4)

- [x] **2.1** Author Physics, Chemistry, Medicine questions (2 each: laureate count + a citation-phrase pick) with options + odds derived from the historical tables in `nobeldata.md`. Implemented in `prisma/seed.ts`.
  **Verify:** for each question, the sum of all listed historical outcome-frequencies for that question equals 20 — confirmed by inspection of the seeded rows (Physics 7+13, Chemistry 3+3+14, Medicine 3+6+11, and both prizes' phrase-pick questions).
- [x] **2.2** Author Economics questions (laureate count 6/6/8 solo/two/three-way + an MIT-affiliation pick) and Literature questions ("prose, poetry or other" + a US-citizenship pick).
  **Verify:** same frequency-sums-to-20 check (confirmed); Literature's genre split (15/2/3) matches `nobeldata.md`'s Tab 5 summary (confirmed).
- [x] **2.3** Author Peace questions (individual-only/organisation-only/mixed — computed from Tab 6's year-by-year list, since `nobeldata.md` doesn't state this split directly: 11/6/3 — plus a US-citizenship pick).
  **Verify:** frequency-sums-to-20 check against Tab 6 (confirmed: 11+6+3=20, matching the underlying laureate list).
- [x] **2.4** Author whole-week questions using odds either quoted directly from `nobeldata.md`'s "Answers for the betting questions" section (female-laureate-count buckets) or computed from its raw per-laureate tables where no ready-made frequency existed (average age >72, Africa residency, US-citizen-count buckets — all three verified with a throwaway Node script cross-tabulating every laureate row, not hand-arithmetic; see METHODS.md).
  **Verify:** every whole-week question's `answerDeadline` equals the Physics question's `answerDeadline` exactly — confirmed programmatically (all four whole-week rows show `2026-10-06T09:45:00.000Z`, identical to the Physics question's timestamp).
- [x] **2.5** Set the 2026 announcement dates — confirmed 2026-09-28: Medicine Mon 5 Oct, Physics Tue 6 Oct, Chemistry Wed 7 Oct, Literature Thu 8 Oct, Peace Fri 9 Oct, Economics Mon 12 Oct — as Stockholm-time constants, stored/converted to UTC per METHODS.md.
  **Verify:** a UTC-converted timestamp for each date, spot-checked against timeanddate.com for CET/CEST offset correctness on that specific date.
- [x] **2.6** Fallback rule confirmed 2026-09-28: if none of a question's answer options match the actual outcome, every user is awarded 1 point for that question, and the UI displays the exact copy **"No answer was correct, every user gets 1 point"**.
  **Verify:** Phase 5's scorer unit tests (5.1) include a case asserting this literal message is what's returned/rendered, not just that 1 point is awarded.

---

## Phase 3 — Auth & accounts
**Depends on:** 1.1

- [x] **3.1** Signup form (email, password, confirm password) + GDPR notice text + password hashing (bcryptjs) + row creation with `emailVerified = false`.
  **Verify:** confirmed via a real-browser Playwright run against the local dev DB — signup creates the user and lands on `/signup/check-email`; a direct DB check confirms `passwordHash` is a bcrypt hash, not plaintext, and `emailVerified` starts `false`.
- [x] **3.2** Verification email flow: token generation, Resend send (with a console-log dev fallback until 0.3's API key exists), `/verify?token=` page that flips `emailVerified` and consumes the token exactly once.
  **Verify:** Playwright run confirmed a valid token verifies the account (`/verify` shows "Email verified!"); `consumeEmailVerificationToken` explicitly returns distinct `invalid`/`expired`/`already-used` results rather than silently re-succeeding (each has its own message in `src/app/verify/page.tsx`'s `MESSAGES` map).
- [x] **3.3** Login (blocked until verified) + DB-backed session cookie (httpOnly, Secure in production, SameSite=Lax) + logout.
  **Verify:** Playwright run confirmed an unverified account gets the specific "verify your email" message (not a generic failure), a verified account logs in and reaches `/` showing "Welcome, {displayName}", and logout clears the session and redirects to `/login`.
- [x] **3.4** Password reset flow (request → emailed single-use token → set new password), reusing the `VerificationToken` table from 3.2.
  **Verify:** Playwright run confirmed the full loop: request → reset with new password → old password rejected ("Incorrect email or password") → new password works. Reset also revokes all existing sessions for that user (see `resetPassword` in `src/lib/auth/actions.ts`).
- [x] **3.5** Auto-generated display name assignment at signup (fun/floral-themed name generator, collision-checked for uniqueness).
  **Verify:** `generateUniqueDisplayName` (`src/lib/auth/displayName.ts`) checks DB uniqueness before returning, falling back to a numeric suffix after 10 collisions; observed distinct names ("Breezy Tulip", "Sunny Sunflower", ...) across separate signups with no email/PII in the generated string.
- [x] **3.6** Basic abuse protection on signup/login/password-reset-request (in-memory fixed-window rate limiting per IP, since this is a single-instance small-scale deployment — see METHODS.md).
  **Verify:** `src/lib/rateLimit.ts` + `src/lib/rateLimit.test.ts` (4 unit tests: allows-up-to-limit, throws-over-limit, resets-after-window, tracks-keys-independently). Wired into `signup` (5/min), `login` (15/min), and `requestPasswordReset` (5/min) in `src/lib/auth/actions.ts`.

---

## Phase 4 — Quiz UI & submission flow
**Depends on:** 1.1, 3.3 (needs a logged-in user), 2.x content ideally present but can be built against seed/mock data first

- [x] **4.1** Single logged-in page shell: today's prize's question(s), a countdown timer to that prize's deadline, and the user's current picks pre-filled if already submitted. Shows all currently-open questions across prizes at once (a superset of "today's prize" — see 4.2's rationale), each with its own countdown.
  **Verify:** confirmed 2026-09-28 via `scripts/verify-phase4.ts` (Playwright, real browser against local dev DB) — before a prize's deadline the form is editable; after the deadline the same question renders read-only ("Voting closed. Waiting for the result.") with the submitted answer preserved.
- [x] **4.2** Submit/update-answer server action + UI wiring, enforcing "editable only before that specific prize's deadline" per-question (not per-page). Implemented as a Next.js Server Action (`src/lib/quiz/actions.ts`), not a conventional REST route — still a real server-side endpoint reachable independent of client state.
  **Verify:** confirmed 2026-09-28 via `scripts/verify-phase4.ts` — a form left open past its question's deadline is rejected server-side on submit ("The deadline for this question has passed"), and no `Submission` row is created for the rejected attempt.
- [x] **4.3** Post-announcement view for a given question: correct answer(s), the user's answer, points earned. Running total + current rank are shown via the page-level `Leaderboard` component rather than inside each per-question card.
  **Verify:** confirmed 2026-09-28 via `scripts/verify-phase4.ts` — a graded question shows the correct answer and "Points earned: 0" for a user who never submitted; the `noneMatched` 2.6 fallback shows "Points earned: 1" for a submitter, matching the points formula.
- [x] **4.4** Top-ten leaderboard component, showing only username + total points + today's points for other users (never email or per-question answers). Delivered as part of the page's React Server Component render rather than a standalone JSON API route.
  **Verify:** confirmed by code inspection (`src/lib/quiz/leaderboard.ts`'s Prisma query explicitly `select`s only `id`/`displayName`, no email or answer fields) and by `scripts/verify-phase4.ts` showing the rendered table reflects the correct total.
- [x] **4.5** End-of-week view: once the final prize (Economics) is a day past its *result's admin approval* (not its pre-scheduled announcement date — see below), replace the quiz page with the final full ranked list + a "come back next year" note; a still-logged-in user additionally sees their own full answer history and results.
  **Verify:** confirmed 2026-09-28 via `scripts/verify-phase4.ts` — approving both Economics questions' `Result` rows with `approvedAt` 48h in the past flips the page to "Nobel Quiz — final results" and shows "Your answers this year", with no deploy/restart.

  **Bug found & fixed 2026-09-28:** `isEndOfWeek()` originally gated on `PrizeCategory.announcementAt` (the static pre-scheduled date) instead of the Economics questions' own `Result.approvedAt`. This contradicted Phase 6.5's "nothing goes live until admin-approved" rule and meant a delayed real-world scrape/approval wouldn't delay end-of-week — the page would flip on schedule regardless. Fixed in `src/lib/quiz/getQuizData.ts`: `isEndOfWeek()` now requires every Economics question to have an approved `Result` and compares 24h against the latest `approvedAt` among them.

---

## Phase 5 — Scoring engine
**Depends on:** 1.2, 4.3 (shares the same points formula)

- [x] **5.1** Implement the core scorer: given a `Question`'s confirmed `Result` and all `Submission`s for it, award each matching submission `points = 1 / probability`, and apply the "nothing matched → everyone gets 1 point" fallback from 2.6. Already implemented as `computeSubmissionPoints` (`src/lib/scoring.ts`) during Phase 4.3 (it's what both `getQuizData.ts` and `leaderboard.ts` call) — found on inspection, same as Phase 4's stale-checkbox situation (see METHODS.md).
  **Verify:** `src/lib/scoring.test.ts` covers (a) a normal match ("returns the option's points for a correct pick"), (b) no submission's option matches the result ("returns 0 for an incorrect pick"), (c) a user who never submitted (returns 0, not null/1). Added one missing case 2026-09-28: an assertion that `NO_ANSWER_MATCHED_MESSAGE` is the exact literal copy required by 2.6, closing the gap that TASKS.md itself flagged.
- [x] **5.2** Daily and running total aggregation (materialized or computed-on-read — pick based on measured leaderboard query cost once real data exists). Decision: computed-on-read (`computeLeaderboard` in `src/lib/quiz/leaderboard.ts`) — fine at this game's scale (dozens of users, ~16 questions); revisit only if leaderboard query cost becomes measurable.
  **Verify:** confirmed 2026-09-28 via `scripts/verify-phase5.ts` — graded 6 questions across 3 distinct Stockholm calendar days for one test user (mixing a correct pick, an incorrect pick, the `noneMatched` fallback, and a never-submitted question, with two graded questions landing on the same day), independently re-derived daily buckets straight from Prisma (not reusing `leaderboard.ts`'s grouping code), and confirmed the sum of those daily buckets (7.3) matches both the hand-computed expectation and `computeLeaderboard`'s `totalPoints` for that user.

---

## Phase 6 — Nobel result collection
**Depends on:** 0.4, 1.1, 2.x (need real question/option definitions to grade against)

- [x] **6.1** Per-prize scraper config, using the official `api.nobelprize.org/2.1` JSON API (see METHODS.md — chosen over HTML scraping) rather than URL patterns/CSS selectors: `src/lib/scraping/nobelApi.ts` extracts laureate count, names, gender, birth date/country/continent, affiliation name/country/continent, and motivation text for any (year, prize) pair. Citizenship is not available from this API for any prize (confirmed live) — flagged, not silently guessed.
  **Verify:** `scripts/verify-phase6-scraper.ts` (committed, rerunnable, hits the live API) ran all 6 prizes against real 2025 data — 19/19 checks passed, matching `nobeldata.md`'s 2025 rows (laureate counts, names, genders, motivation-phrase categorization, MIT affiliation, Peace individual/org type, whole-week female count).
- [x] **6.2** Scheduler logic: `src/lib/scraping/scheduler.ts`'s `shouldAttempt` (pure, no I/O) decides per-question; `runSchedulerTick` wires it to real Prisma + the scraper, ticked every minute from `instrumentation.ts` (replacing 0.4's heartbeat). Retry bookkeeping lives on `Result.scrapeAttempts`/`lastAttemptAt` (see METHODS.md) — capped at `MAX_ATTEMPTS` (~24h at 15-min intervals), after which a row just stays `PENDING` and shows up on the admin page as needing manual attention.
  **Verify:** `src/lib/scraping/scheduler.test.ts` — the exact TASKS.md scenario ("2 minutes ago" → no attempt, "6 minutes ago" → one attempt), plus retry-interval, attempt-cap, and PROPOSED/APPROVED-never-re-attempt cases. All passing (`npm test`).
- [x] **6.3** Auto-grading: `src/lib/scraping/grader.ts` computes a canonical value per question's `gradingKey` (new schema field, alongside `AnswerOption.matchValue` — see METHODS.md for why regexing player-facing labels was rejected) and matches it against the question's options, producing a `PROPOSED` `Result` (never visible to players — gated by 6.5). Literature genre and both citizenship questions have no `gradingKey` and are never auto-graded, by design (no reliable signal exists — see METHODS.md).
  **Verify:** `src/lib/scraping/grader.test.ts` feeds real 2025 outcomes (fixtures matching nobeldata.md exactly) through the grader against the actual 2026-seeded options, including a case confirming the 2.6 "none matched" fallback fires for a hypothetical solo Physics year. All passing.
- [x] **6.4** Admin override page (`/admin/results`, gated on `User.isAdmin`): lists every past-deadline question not yet approved, shows any scraper proposal (pre-selected radio) plus raw scraped data, and lets the admin pick/correct the answer (or "none matched") and approve.
  **Verify:** `scripts/verify-phase6-admin.ts` (committed, rerunnable Playwright script) — a real admin user (promoted via the one-off DB update documented in METHODS.md) deliberately overrides a deliberately-wrong scraper proposal, approves the correction, and a separate logged-in player's page is confirmed to reflect the corrected answer, never the original wrong proposal. Also confirms a non-admin is denied the page. 8/8 checks passed.
- [x] **6.5** "Go live" gate: already implemented as of the Phase 4 audit (`getQuizData.ts`/`leaderboard.ts` both gate on `Result.approvedAt`) — Phase 6 only added the write path (`approveResult` in `src/lib/admin/actions.ts`) that's allowed to set it.
  **Verify:** covered by the same `scripts/verify-phase6-admin.ts` run — before admin approval, a `PROPOSED` result (with a deliberately wrong answer already sitting in the DB) shows neither a correct answer nor the wrong proposal to a logged-in player; only after `approveResult` sets `approvedAt` does the corrected answer appear.

---

## Phase 7 — Design & accessibility
*Runs in parallel with Phases 3–6 once basic pages exist to skin.*

- [x] **7.1** Warm/floral color palette + font pairing, applied as Tailwind theme tokens (not one-off inline colors). Found already implemented on inspection 2026-09-29 (same stale-checkbox situation as several earlier phases — see METHODS.md): `src/app/globals.css` defines the palette as CSS custom properties wired into Tailwind v4 via `@theme inline`; `Fraunces` (display/headings) + `Karla` (body) are loaded in `src/app/layout.tsx`. No inline hex colors or default-Tailwind-palette classes anywhere in `src/app`/`src/components`.
  **Verify:** `scripts/verify-phase7-contrast.ts` (committed, rerunnable, parses the actual hex values out of `globals.css` so it can't drift from reality) — re-run 2026-09-29, all 18 text/background and UI-boundary pairs pass WCAG AA (ratios 3.36:1–13.73:1).
- [x] **7.2** Keyboard-navigation and screen-reader pass on the login form, quiz form, and leaderboard. Also found already implemented 2026-09-29 (focus-visible outline + skip link in `globals.css`, `aria-`/`role=`/`htmlFor` wiring across the auth and quiz components).
  **Verify:** `scripts/verify-phase7-a11y.ts` (Playwright + axe-core) — first live run 2026-09-29 surfaced and fixed three real bugs rather than being taken on faith: (1) `AxeBuilder` needs a page created via `browser.newContext()`, not `browser.newPage()` directly, on the installed `@axe-core/playwright` version — it was throwing immediately, and because the browser was never closed on that path the process hung until killed; now wrapped in try/finally so any future failure still closes the browser; (2) the signup Tab-order assertions didn't account for the inline "full privacy notice" link (Phase 8.1, also already implemented) that now sits before the email field, so every downstream assertion was off by one; (3) the local dev DB had Economics `Result` rows approved >24h in the past from an earlier phase's verify run, which flipped `isEndOfWeek()` to true and replaced the whole quiz page with the final-results view — the script now explicitly resets that state itself (same ownership pattern it already used for the Medicine question) rather than assuming another script left the DB in a compatible state. After all three fixes, a clean re-run passed all 21 checks (4 axe scans + full keyboard-only signup → verify → login → answer → leaderboard flow). The VoiceOver half of the verify condition is inherently manual and still outstanding — axe + keyboard-only focus-order coverage is the automated, regression-catching part of it.
- [x] **7.3** Responsive layout pass (phone/tablet/desktop) for the single main page. Deliberately no `sm:`/`md:`/`lg:` breakpoint classes anywhere — a fluid, mobile-first single-column layout (`max-w-2xl`, `flex flex-wrap`) rather than an unstarted task.
  **Verify:** `scripts/verify-phase7-responsive.ts` (Playwright) — run 2026-09-29 against home/login/signup/quiz-page at 375/768/1440px: 13/13 checks passed (no horizontal scroll at any width/page, no unexpected overlapping elements on the quiz page at 375px).

---

## Phase 8 — GDPR & legal content
*No hard dependency — content can be drafted anytime; wiring depends on 3.1.*

- [x] **8.1** Draft plain-language GDPR notice: what's stored (email, hashed password, answers, points), why (login, verification, result notification, leaderboard), retention, and how to request deletion.
  **Verify:** notice is shown on the signup page before account creation, and linked from the logged-in page footer.
- [x] **8.2** Account/data deletion path: deleting an account removes the user row *and* all of their historical answers/submissions/scores outright (confirmed 2026-09-28 — no anonymized retention). Delivered as self-service: `deleteAccount` (`src/lib/auth/actions.ts`) behind a password-confirmed form on `/privacy`; cascades handle dependent rows.
  **Verify:** deleting a test account leaves zero rows referencing that user (`User`, `Session`, `Submission`, score rows all gone via cascade or explicit delete), and the leaderboard/top-ten recomputes correctly for remaining users with no orphaned rows or broken foreign keys.

---

## Phase 9 — Deployment
**Depends on:** enough of Phases 0–6 to have something worth deploying; can start a skeleton deploy as early as Phase 0.

- [x] **9.1** Railway deploy pipeline: build command runs `prisma migrate deploy`, start command runs `next start`; env vars for `DATABASE_URL`, `RESEND_API_KEY`, session secret. Done 2026-09-29: `web` service deploys from GitHub `main` at https://web-production-e4497.up.railway.app; `npx prisma migrate deploy` is the service's pre-deploy command (`railway.json` is ignored by Railway, so it was removed); no session secret needed (DB-backed sessions). Production seeded once by the user from a terminal (6 categories, 16 questions, 40 options) — see METHODS.md.
  **Verify:** a fresh push to the deploy branch results in a live, reachable `*.up.railway.app` URL with a working DB connection, with no manual steps run by hand on the server.
- [x] **9.2** Public URL: decided 2026-09-29 to stay on the Railway-provided domain (`web-production-e4497.up.railway.app`, HTTPS certificate managed by Railway) instead of pointing a one.com domain at the service. Email is separate: `mail.hulabeck.se` was verified in Resend and `EMAIL_FROM_ADDRESS` is set to `Nobel Quiz <noreply@mail.hulabeck.se>` on Railway.
  **Verify:** the custom domain resolves to the app over HTTPS with a valid certificate.
- [x] **9.3** Basic uptime/error visibility (Railway's built-in logs/metrics is sufficient at this scale — confirm no extra paid tool is needed). Confirmed 2026-09-29: a deliberate bad request (bogus Server Action POST + unknown path) showed up in Railway's HTTP log within a second; app-side exceptions (e.g. the scheduler's failed ticks) appear in the deploy log with stack traces. No extra tool needed.
  **Verify:** deliberately trigger a server error (e.g. a bad request) and confirm it's visible in Railway's log stream within a minute.

---

## Phase 10 — End-to-end QA
**Depends on:** everything above, at least in a staging-quality state.

- [ ] **10.1** Full dry run using the *2025* results as if they were live: seed 2026 questions, fast-forward mocked "announcement times" to the past, run the scraper against real 2025 nobelprize.org pages, confirm scoring and leaderboard match hand-calculated expectations from `nobeldata.md`.
  **Verify:** a test user's total score after all 6 mocked "2026" prizes matches a hand computation done independently from the code, using the formula in METHODS.md.
- [ ] **10.2** Multi-user concurrency smoke test: several accounts answering, changing answers before deadline, and viewing the leaderboard at once.
  **Verify:** no answer submitted by one user ever appears attributed to another; leaderboard totals stay internally consistent (sum of visible top-ten "today" points is plausible given known test submissions).

---

## Phase 9b — Post-deploy refinements (requested 2026-09-29)

- [x] **9b.1** Email verification link must survive mail scanners: `/verify` GET is read-only, a "Confirm my email" button POSTs the consuming action.
  **Verify:** `scripts/verify-email-link-prefetch.ts` — bare GETs leave token/account untouched; confirming verifies; reuse reports already-used (7/7).
- [x] **9b.2** Default display names are former laureates (deceased only) with a short blurb ("Physics 1921") shown next to the name; users can choose their own name or re-roll a random laureate on `/account`.
  **Verify:** `scripts/verify-laureate-names.ts` checks all 68 entries against the official Nobel API (year, category, complete award list, deceased); `src/lib/auth/displayNameRules.test.ts` covers the rules; `scripts/verify-account-and-order.ts` drives the real UI (laureate default + blurb, custom name, case-insensitive clash, laureate-name and bad-character rejection, random re-roll).
- [x] **9b.3** Quiz page lists questions chronologically by announcement day (Medicine first, Stockholm calendar days), a thin divider between days and a heavier divider before the whole-week questions; replaces the open/awaiting/graded sections (status is shown on each card).
  **Verify:** `scripts/verify-account-and-order.ts` — day headings in order, whole-week last, computed border widths 1px between days and 4px before whole-week; `formatStockholmDay` unit tests.

---

## Open items requiring a decision before the relevant phase starts
- None currently outstanding.

## Resolved items
- **2.5** (2026-09-28): 2026 dates confirmed as Medicine 5 Oct, Physics 6 Oct, Chemistry 7 Oct, Literature 8 Oct, Peace 9 Oct, Economics 12 Oct.
- **2.6** (2026-09-28): fallback copy confirmed as "No answer was correct, every user gets 1 point".
- **8.2** (2026-09-28): account deletion removes historical answers outright rather than anonymizing them in place.
