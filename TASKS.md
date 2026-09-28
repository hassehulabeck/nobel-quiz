# TASKS.md — Project Plan

Status legend: `[ ]` not started · `[~]` in progress · `[x]` done

Tasks are grouped into phases. Within a phase, tasks are written to be as non-blocking as possible — most can be picked up in parallel once the phase's shared prerequisite (usually the Prisma schema) exists. Hard dependencies are called out explicitly under **Depends on**. Every task or tight group of tasks has a **Verify** condition.

---

## Phase 0 — Scaffolding
*No dependencies. Can start immediately.*

- [ ] **0.1** Init Next.js 14 (App Router, TypeScript) project; add Tailwind CSS + shadcn/ui; add Prisma; add ESLint/Prettier.
  **Verify:** `npm run dev` serves a blank page at `/` with no console errors; `npm run build` succeeds.
- [ ] **0.2** Add Railway project with a Postgres plugin attached to the app service; wire `DATABASE_URL`.
  **Verify:** `prisma db pull` (or a trivial `SELECT 1`) succeeds against the Railway Postgres instance from a local shell using the Railway-provided connection string.
- [ ] **0.3** Add Resend API key as an env var; send one test email via a throwaway script.
  **Verify:** a test email arrives in an inbox you control, sent through the Resend API using the project's env var.
- [ ] **0.4** Set up `instrumentation.ts` scaffold with a no-op interval (proves the "always-on process" assumption holds on Railway before real scraping logic is built on top of it).
  **Verify:** deploy to Railway, confirm via logs that the interval fires repeatedly over a 10+ minute window without the process restarting or sleeping.

---

## Phase 1 — Data model
**Depends on:** 0.1

- [ ] **1.1** Write the Prisma schema: `User`, `Session`, `VerificationToken`, `Prize` (the 6 categories + a virtual "week" scope), `Question`, `AnswerOption` (with `probability`/`points` precomputed), `Submission` (user's picked option per question, editable until deadline), `Result` (admin-confirmed or scraped outcome per question), `DailyScore`/`TotalScore` (or compute on read — decide at implementation time).
  **Verify:** `prisma migrate dev` runs clean; a seed script can create one user, one prize, one question, one answer option, and one submission without constraint errors.
- [ ] **1.2** Write the odds/points calculator as a small pure function taking a historical frequency (e.g. `4/20`) and returning `points = 1 / probability`, matching the worked example in instructions.md (4/20 → 5 points).
  **Verify:** unit test: `points(4, 20) === 5`; `points(0, 20)` throws or is handled explicitly (never awarded historically → must not divide by zero) — decide and document the guard in this file's Phase 1 notes once hit.

---

## Phase 2 — Question content authoring
**Depends on:** 1.1 (schema shape only, not a running DB — can be written as seed data in parallel with Phase 0/3/4)

- [ ] **2.1** Author Physics, Chemistry, Medicine questions (2–3 each: laureate count, a citation-phrase pick, an affiliation pick) with options + odds derived from the historical tables in `nobeldata.md`.
  **Verify:** for each question, the sum of all listed historical outcome-frequencies for that question equals 20 (all 20 years accounted for, e.g. Physics laureate-count: 0 + 7 + 13 = 20).
- [ ] **2.2** Author Economics questions (laureate count skews flatter: 6/6/8 solo/two/three-way) and Literature questions ("prose, poetry or other" + a citizenship/other pick).
  **Verify:** same frequency-sums-to-20 check; Literature's genre split (15/2/3) matches `nobeldata.md`'s Tab 5 summary.
- [ ] **2.3** Author Peace questions (organisation-vs-individual is a real historical split unique to this prize; a citizenship/geography pick).
  **Verify:** frequency-sums-to-20 check against Tab 6.
- [ ] **2.4** Author whole-week questions ("How many female laureates total?", "Average age over 72?", "Any laureate resident in Africa?", "How many American citizens?") using the "Answers for the betting questions" section of `nobeldata.md` for odds, each sharing the Physics announcement's deadline.
  **Verify:** every whole-week question's `answerDeadline` equals the Physics question's `answerDeadline` exactly (same timestamp, not just same day).
- [x] **2.5** Set the 2026 announcement dates — confirmed 2026-09-28: Medicine Mon 5 Oct, Physics Tue 6 Oct, Chemistry Wed 7 Oct, Literature Thu 8 Oct, Peace Fri 9 Oct, Economics Mon 12 Oct — as Stockholm-time constants, stored/converted to UTC per METHODS.md.
  **Verify:** a UTC-converted timestamp for each date, spot-checked against timeanddate.com for CET/CEST offset correctness on that specific date.
- [x] **2.6** Fallback rule confirmed 2026-09-28: if none of a question's answer options match the actual outcome, every user is awarded 1 point for that question, and the UI displays the exact copy **"No answer was correct, every user gets 1 point"**.
  **Verify:** Phase 5's scorer unit tests (5.1) include a case asserting this literal message is what's returned/rendered, not just that 1 point is awarded.

---

## Phase 3 — Auth & accounts
**Depends on:** 1.1

- [ ] **3.1** Signup form (email, password, confirm password) + GDPR notice text + password hashing (bcrypt) + row creation with `emailVerified = false`.
  **Verify:** submitting valid signup creates exactly one `User` row with a bcrypt hash (never a plaintext password) and `emailVerified = false`.
- [ ] **3.2** Verification email flow: token generation, Resend send, `/verify?token=` route that flips `emailVerified` and consumes the token exactly once.
  **Verify:** clicking a valid link verifies the account; clicking it a second time, or a token past its expiry, is rejected with a clear message rather than silently succeeding.
- [ ] **3.3** Login (blocked until verified) + DB-backed session cookie (httpOnly, Secure, SameSite=Lax) + logout.
  **Verify:** an unverified account cannot log in (clear error, not a generic failure); a verified account gets a session cookie that survives a page reload and is invalidated on logout.
- [ ] **3.4** Password reset flow (request → emailed single-use token → set new password), reusing the `VerificationToken` table from 3.2.
  **Verify:** old password stops working and new password works immediately after a completed reset; the reset token cannot be reused.
- [ ] **3.5** Auto-generated display name assignment at signup (fun/floral-themed name generator, collision-checked for uniqueness).
  **Verify:** creating 100 test accounts in a loop produces 100 unique display names with no collisions and no email/PII leaking into the generated name.
- [ ] **3.6** Basic abuse protection on signup/login (rate limiting per IP and/or per email).
  **Verify:** an automated script hitting `/login` or `/signup` repeatedly gets throttled (429 or equivalent) well before, say, 20 attempts/minute from one IP.

---

## Phase 4 — Quiz UI & submission flow
**Depends on:** 1.1, 3.3 (needs a logged-in user), 2.x content ideally present but can be built against seed/mock data first

- [ ] **4.1** Single logged-in page shell: today's prize's question(s), a countdown timer to that prize's deadline, and the user's current picks pre-filled if already submitted.
  **Verify:** before a prize's deadline, the page shows the form as editable; after the deadline, the same page shows the same questions as read-only with the submitted answers.
- [ ] **4.2** Submit/update-answer API + UI wiring, enforcing "editable only before that specific prize's deadline" per-question (not per-page), since multiple prizes' questions can be open at once during the week.
  **Verify:** attempting to submit/change an answer for a prize whose deadline has passed is rejected server-side even if the client UI is somehow bypassed (e.g. direct API call via curl).
- [ ] **4.3** Post-announcement view for a given prize: correct answer(s), the user's answer, points earned that day, running total, current rank.
  **Verify:** for a prize with a confirmed `Result`, the displayed "today's points" for a test user matches a hand-calculated value using the Phase 1.2 points formula.
- [ ] **4.4** Top-ten leaderboard component, showing only username + total points + today's points for other users (never email or per-question answers).
  **Verify:** inspect the actual API response payload for the leaderboard endpoint as a logged-in non-admin user — confirm no email addresses or other users' individual answers are present in the JSON, not just hidden in the UI.
- [ ] **4.5** End-of-week view: once the final prize (Economics) is a day past announcement, replace the quiz page with the final full ranked list + a "come back next year" note; a still-logged-in user additionally sees their own full answer history and results.
  **Verify:** manually flip a test `Result` row's timestamp to "26+ hours ago" and confirm the page switches views without a deploy/restart.

---

## Phase 5 — Scoring engine
**Depends on:** 1.2, 4.3 (shares the same points formula)

- [ ] **5.1** Implement the core scorer: given a `Question`'s confirmed `Result` and all `Submission`s for it, award each matching submission `points = 1 / probability`, and apply the "nothing matched → everyone gets 1 point" fallback from 2.6.
  **Verify:** unit tests covering (a) a normal match, (b) no submission's option matches the result, (c) a user who never submitted an answer for that question (should score 0, not 1).
- [ ] **5.2** Daily and running total aggregation (materialized or computed-on-read — pick based on measured leaderboard query cost once real data exists).
  **Verify:** total points for a test user equals the sum of that user's daily scores across every prize announced so far, checked directly against the DB.

---

## Phase 6 — Nobel result collection
**Depends on:** 0.4, 1.1, 2.x (need real question/option definitions to grade against)

- [ ] **6.1** Per-prize scraper config: candidate nobelprize.org URL patterns, and a parser that extracts laureate count, names, affiliation, citizenship, sex, age, and motivation text.
  **Verify:** run each of the 6 scrapers against the *2025* announcement pages (already resolved, in the past) and confirm the extracted data matches `nobeldata.md`'s 2025 rows exactly.
- [ ] **6.2** Scheduler logic: for each prize, start attempting 5 minutes after its announcement time, retry on a fixed interval if not yet found, stop retrying (and flag for admin) after a bounded number of attempts or a bounded time window.
  **Verify:** with a mocked "announcement time = 2 minutes ago," confirm no scrape attempt fires yet; with "6 minutes ago," confirm one has fired.
- [ ] **6.3** Auto-grading: match scraped data against each question's answer options (count match, phrase-in-motivation match, affiliation match, etc.), producing a *proposed* `Result` — not yet visible to players.
  **Verify:** feed the 2025 scraped data (from 6.1) through this against the 2026-authored question options where the option text was copied from 2025-equivalent phrasing as a test fixture, and confirm the proposed grading matches what a human would pick by reading `nobeldata.md`.
- [ ] **6.4** Admin override page: lists any prize whose scrape failed/timed out, or whose proposed grading is pending confirmation; lets the admin manually enter/correct laureate data and approve grading before it goes live to players.
  **Verify:** as the admin user, deliberately reject a proposed auto-grading, enter a correction, approve it, and confirm the player-facing pages (4.3) reflect the corrected result, not the original proposal.
- [ ] **6.5** "Go live" gate: a `Result` only becomes visible to players and only triggers scoring once admin-approved (even if auto-grading was correct) — keeps a human in the loop for every single prize, not just the failure cases.
  **Verify:** create an unapproved `Result` row directly in the DB and confirm no player-facing page or score changes until an `approvedAt` timestamp is set.

---

## Phase 7 — Design & accessibility
*Runs in parallel with Phases 3–6 once basic pages exist to skin.*

- [ ] **7.1** Warm/floral color palette + font pairing, applied as Tailwind theme tokens (not one-off inline colors).
  **Verify:** every text/background color pair used in the UI passes WCAG AA contrast (4.5:1 body text, 3:1 large text) — check with a contrast checker on each token pair.
- [ ] **7.2** Keyboard-navigation and screen-reader pass on the login form, quiz form, and leaderboard.
  **Verify:** complete a full signup → login → answer a question → view leaderboard flow using only the keyboard (no mouse), and with a screen reader (VoiceOver) reading meaningful labels at every step.
- [ ] **7.3** Responsive layout pass (phone/tablet/desktop) for the single main page.
  **Verify:** manual check at 375px, 768px, and 1440px widths — no horizontal scroll, no overlapping/clipped content.

---

## Phase 8 — GDPR & legal content
*No hard dependency — content can be drafted anytime; wiring depends on 3.1.*

- [ ] **8.1** Draft plain-language GDPR notice: what's stored (email, hashed password, answers, points), why (login, verification, result notification, leaderboard), retention, and how to request deletion.
  **Verify:** notice is shown on the signup page before account creation, and linked from the logged-in page footer.
- [ ] **8.2** Account/data deletion path (self-service or admin-assisted — confirm which with the user before building).
  **Verify:** deleting a test account removes/anonymizes their email and personal data while preserving aggregate leaderboard integrity for other users (decide and document whether deleted users' historical answers are removed or anonymized in place).

---

## Phase 9 — Deployment
**Depends on:** enough of Phases 0–6 to have something worth deploying; can start a skeleton deploy as early as Phase 0.

- [ ] **9.1** Railway deploy pipeline: build command runs `prisma migrate deploy`, start command runs `next start`; env vars for `DATABASE_URL`, `RESEND_API_KEY`, session secret.
  **Verify:** a fresh push to the deploy branch results in a live, reachable `*.up.railway.app` URL with a working DB connection, with no manual steps run by hand on the server.
- [ ] **9.2** (When ready) point a one.com domain's DNS at the Railway service.
  **Verify:** the custom domain resolves to the app over HTTPS with a valid certificate.
- [ ] **9.3** Basic uptime/error visibility (Railway's built-in logs/metrics is sufficient at this scale — confirm no extra paid tool is needed).
  **Verify:** deliberately trigger a server error (e.g. a bad request) and confirm it's visible in Railway's log stream within a minute.

---

## Phase 10 — End-to-end QA
**Depends on:** everything above, at least in a staging-quality state.

- [ ] **10.1** Full dry run using the *2025* results as if they were live: seed 2026 questions, fast-forward mocked "announcement times" to the past, run the scraper against real 2025 nobelprize.org pages, confirm scoring and leaderboard match hand-calculated expectations from `nobeldata.md`.
  **Verify:** a test user's total score after all 6 mocked "2026" prizes matches a hand computation done independently from the code, using the formula in METHODS.md.
- [ ] **10.2** Multi-user concurrency smoke test: several accounts answering, changing answers before deadline, and viewing the leaderboard at once.
  **Verify:** no answer submitted by one user ever appears attributed to another; leaderboard totals stay internally consistent (sum of visible top-ten "today" points is plausible given known test submissions).

---

## Open items requiring a decision before the relevant phase starts
- **8.2**: whether account deletion removes or anonymizes historical answers — need a quick confirmation from the user when Phase 8 is reached, not blocking earlier work.

## Resolved items
- **2.5** (2026-09-28): 2026 dates confirmed as Medicine 5 Oct, Physics 6 Oct, Chemistry 7 Oct, Literature 8 Oct, Peace 9 Oct, Economics 12 Oct.
- **2.6** (2026-09-28): fallback copy confirmed as "No answer was correct, every user gets 1 point".
