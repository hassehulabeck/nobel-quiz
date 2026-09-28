# METHODS.md — Decision Log

This file records every major decision made on the Nobel Quiz project, in the order they were made, with the reasoning behind them. Per `CLAUDE.md`, this is updated whenever a significant choice is made — architecture, scope, data modeling, or process.

---

## 2026-09-28 — Clarifying questions (round 1)

Per `CLAUDE.md`, before selecting an architecture, `instructions.md` and `nobeldata.md` were read in full and up to 10 clarifying questions were asked. Answers below drive every decision in this document.

| # | Question | Answer |
|---|---|---|
| 1 | How do the existing accounts (Railway, one.com, Resend) map onto the architecture? | Railway = app + Postgres DB. one.com = DNS only. Resend = transactional email. |
| 2 | Evergreen multi-year platform, or one-off for 2026? | One-off for 2026. |
| 3 | How is the leaderboard username set? | Auto-generated fun display name, decoupled from email. |
| 4 | Admin override if scraping nobelprize.org fails? | Yes — a simple admin page for manual result entry/correction. |
| 5 | Timezone handling for announcements/deadlines? | Store in Stockholm time (CET/CEST); convert to each visitor's local time for display. |
| 6 | Hosting budget? | Free/hobby tiers where possible; flag clearly if something needs a paid tier. |
| 7 | Custom domain via one.com? | Not yet — launch on Railway's default subdomain, add domain later. |
| 8 | Expected scale / access model? | Small and private (friends/colleagues); open signup, not advertised. Real accounts with email verification still required. |
| 9 | Tech stack preference? | None — architect's choice. |

### Interpretation notes (assumptions made explicit, since no follow-up round was triggered)
- **"A user should be able to change prize specific questions in the middle of the game"** (instructions.md, Users section) is interpreted as *a user may change their own submitted answers* to a prize's questions any time before that prize's announcement — not that users edit the question definitions themselves. Question definitions/content are admin/config-only.
- **Numeric "guesstimate" questions** (average age, total American citizens, etc.) are NOT free-text numeric entry. Per instructions.md ("no more than four, maybe five alternative answers" applies to *every* question), these are presented as a small set of bucketed choices (e.g., ranges), each carrying its own historical-frequency-derived odds, scored with the exact same `points = 1 / probability` mechanism as every other question. This keeps one scoring engine for the whole game instead of a second, distance-based system.
- **Odds/probabilities are static**, computed once from the 2006–2025 historical table in `nobeldata.md` and hardcoded into each question's answer options at content-authoring time. They are not recalculated dynamically from how this year's players answer (no pari-mutuel pool betting) — this matches the worked example in instructions.md ("1 laureate 4/20 times... 5 points = 1/(4/20)").
- **Literature genre and other judgement-based gradings** (e.g., "prose, poetry or other", motivation-phrase matches) cannot always be graded by pure string matching. The admin override page doubles as a **grading confirmation step**: the scraper proposes an answer/grading, an admin confirms or corrects it before points are posted. This reuses the same page built for scraping failures instead of a second UI.
- **2026 Nobel week dates** — confirmed with the user 2026-09-28 (a conflicting instruction had briefly suggested swapping Physics and Medicine; the user confirmed the reading below, which matches `nobeldata.md`'s own caveats and the traditional announcement order): Medicine Mon 5 Oct, Physics Tue 6 Oct, Chemistry Wed 7 Oct, Literature Thu 8 Oct, Peace Fri 9 Oct, Economics Mon 12 Oct (week 42, not week 41 — instructions.md's "week 41" framing is now one week off for 2026 and is treated as informational, not a hard constraint).

---

## Architecture

**Stack:** Next.js 14 (App Router, TypeScript), single Node deployment, PostgreSQL, Prisma ORM, Tailwind CSS + shadcn/ui (Radix-based, accessible by default), Resend for email, deployed as one Railway service.

**Why a single Next.js app instead of separate frontend/backend:**
- The whole product is one page (login → single quiz/leaderboard/prize-info page) plus a small admin surface. A split frontend/backend adds deployment surface (two services, two URLs, CORS) for no real benefit at this scale.
- Railway bills per service; one service keeps this on the free/hobby tier as requested.
- Next.js Server Components let the single page read from Postgres directly for logged-in state, the quiz form, and the leaderboard without hand-rolling a separate REST/GraphQL layer — Route Handlers (`app/api/*`) cover the few places that need imperative POST/GET semantics (submit answer, admin override, cron tick).

**Why Prisma over a raw SQL layer or Drizzle:**
- Small schema, small team (one dev). Prisma's migration workflow (`prisma migrate deploy` in the Railway build step) and generated types reduce hand-written boilerplate for what is a fairly conventional relational schema (users, questions, answer options, submissions, results).

**Why a custom auth implementation instead of NextAuth/Auth.js:**
- Requirement is specifically "regular" security: email + password + a verification email via an existing Resend account. NextAuth's credentials provider does not include first-class email verification or password reset flows; wiring those on top of it isn't meaningfully less code than a small, fully-understood custom implementation.
- Design: `bcrypt` password hashes; a `sessions` table (DB-backed, not JWT) referenced by a signed, `httpOnly`, `Secure` cookie, so sessions can be revoked server-side; a `verification_tokens` table for both email verification and password reset, single-use, time-limited; Resend sends both emails. Login is blocked until `emailVerified = true`.

**Why an in-process scheduler instead of Railway Cron or a second worker service:**
- Railway keeps a web service's process alive (unlike serverless platforms), so a simple `setInterval`-based checker registered once via Next.js `instrumentation.ts` can poll on its own schedule without needing a second billed service or Railway's Cron Jobs add-on (which sits on paid plans). This satisfies "start 5 minutes after the announcement time, then retry regularly" from instructions.md at zero extra infrastructure cost.
- Each prize category has its own small scraper config (candidate URL patterns + parsing rules), since instructions.md notes the announcement page URLs vary year to year. If a scrape fails after a bounded number of retries (or produces a result an admin hasn't confirmed), it surfaces on the admin override page instead of silently blocking the game.

**Why bucketed multiple-choice for every question type (including numeric ones):**
- Keeps exactly one scoring formula (`points = 1 / probability`) across the entire app — no branching logic between "categorical" and "numeric" question types in the scoring engine, admin tooling, or UI components. Simpler code, and it's what instructions.md's own worked example describes.

**Timezone handling:** all `announcementAt` / `answerDeadline` timestamps are stored in UTC (derived from Stockholm/CET-CEST source times at content-authoring time) and rendered client-side via `Intl.DateTimeFormat` in the visitor's local timezone, with the countdown timer computed client-side against the UTC deadline.

**Accessibility & design:** warm/floral palette (marigold, coral, sage, lavender) checked against WCAG AA contrast; shadcn/ui (Radix primitives) for interactive components (accordions, tabs, dialogs) to get keyboard nav and ARIA semantics for free; a playful display font for headings paired with a highly legible body font; no information conveyed by color alone (icons/text accompany every status indicator).

**GDPR:** a short, plain-language notice at signup explaining that the email address is stored solely for login and result notification, is never shown to other users, and can be deleted on request. Confirmed 2026-09-28: deletion removes the account **and** its historical answers/submissions/scores outright — no anonymized retention of past answers.

---

## Scope boundary (one-off 2026 build)

Per answer #2, the schema is not artificially generalized for multi-year reuse. It is deliberately simple: one `season` concept exists (a single row) rather than a `years` table with foreign keys everywhere. If the game is run again next year, question content and historical odds get updated in place; this is called out explicitly rather than silently over-engineered "for the future."

---

## 2026-09-28 — Implementation notes (Phase 0/1 scaffolding)

`create-next-app` and `prisma init` both generate an `AGENTS.md`/skills bundle warning that their installed versions have moved past this model's training data. That turned out to be true in ways that changed the plan below — recorded here so later work doesn't rediscover the same surprises.

- **Versions pinned:** Next.js `16.3.6`, React `19.2.8`, Prisma CLI + `@prisma/client` both pinned to the exact same stable version, `7.10.0` (not `^7.10.0`) — `npm install prisma @prisma/client` on its own resolved to a `prisma@8.0.0-rc.17` / `@prisma/client@7.10.0` mismatch, which is a prerelease CLI paired with a stable client. Exact-pinning both to the latest matching stable release avoids that drift; re-check both together before ever bumping one.
- **Prisma 7 requires a driver adapter** for every SQL provider — there is no more implicit `node_modules`-generated client with a bundled engine binary. Added `@prisma/adapter-pg` + `pg`, and `src/lib/prisma.ts` constructs `new PrismaClient({ adapter: new PrismaPg({ connectionString: ... }) })` rather than the old bare `new PrismaClient()`.
- **Generated client location moved out of `node_modules`.** The schema's `generator client` block now requires an explicit `output` path; ours is `src/generated/prisma`, imported as `@/generated/prisma/client`. That directory is gitignored and regenerated via `npx prisma generate` (already wired into `postinstall` is *not* set up — remember to run it after every fresh clone/`npm install`, and Railway's build step must run it before `next build`).
- **Config moved out of `schema.prisma`.** The datasource block only declares `provider = "postgresql"`; the actual `DATABASE_URL` (and future `directUrl`/`shadowDatabaseUrl` if Railway's pooler needs them) lives in `prisma7.config.ts` at the repo root, loaded via `import "dotenv/config"`. The Prisma CLI auto-detects `prisma7.config.ts` — no need to rename it to `prisma.config.ts`.
- **Project is ESM-first** (`"type": "module"` in `package.json`), because the generated Prisma client uses `import.meta.url` internally and Prisma's own v7 upgrade guidance recommends ESM-first over forcing `moduleFormat = "cjs"`. All hand-written config files were already `.ts`/`.mjs`, so this had no fallout — confirmed via a clean `npm run build` and `npm test` after the switch.
- **Standalone scripts (seed scripts, one-off checks) do not get `.env` for free.** Next.js loads `.env` automatically for `next dev`/`next build`/`next start`, but running a script directly via `tsx` does not — use `node --env-file=.env node_modules/.bin/tsx <script>` (or add `import "dotenv/config"` at the top of the script) or `DATABASE_URL` will silently fall through to `pg`'s OS-user-based default connection instead of erroring clearly.
- **Turbopack root:** explicitly set `turbopack.root` in `next.config.ts` to the project directory. Without it, Next.js searched upward for a lockfile and found an unrelated one directly in the home directory, which would have silently mis-scoped file tracing.
- **`npm audit` reports 4 high-severity findings** (`deepmerge-ts`, `mysql2`) that are transitive dependencies of the Prisma CLI's multi-database tooling, not of `@prisma/client` or anything shipped at runtime. `npm audit fix --force` would downgrade to `prisma@6.19.3`, an older major we don't want. Accepted as a build-tool-only risk for now; revisit when Prisma ships a patched CLI release.
- **Local dev database:** a Homebrew-managed local Postgres 14 (already running on this machine) hosts a scratch `nobel_quiz_dev` database for migration/seed development before Railway credentials are available. `prisma migrate dev` and a manual `$queryRaw`/`user.count()` round trip both verified against it.
- **Test runner:** Vitest (not Jest) — lighter config for a Next.js + ESM project. `npm test` runs `vitest run`. First test suite covers the Phase 1.2 points calculator (`src/lib/scoring.ts`), matching instructions.md's worked example (4/20 → 5 points) plus zero/overflow guards.
