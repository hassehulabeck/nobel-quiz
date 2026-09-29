import "dotenv/config";
import { execFileSync } from "node:child_process";

// TASKS.md 10.1: replay the 2025 Nobel week as if it were the 2026 game.
// Seeds the real 2026 questions into a throwaway database, moves every
// announcement/deadline to the real 2025 dates, fast-forwards a mocked
// clock, runs the real scheduler against the live api.nobelprize.org, has
// "the admin" approve, and compares every proposal and every user's total
// against an answer key and point values transcribed by hand from
// nobeldata.md (NOT read back from the DB or the scoring code).
//
// Needs network access. Uses a scratch database (nobel_quiz_e2e) created and
// dropped by this script, so the dev data is never touched; set KEEP_DB=1 to
// keep it for inspection.

function log(step: string, ok: boolean, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"} - ${step}${extra ? ": " + extra : ""}`);
  if (!ok) process.exitCode = 1;
}

const SCRATCH_DB = "nobel_quiz_e2e";
const baseUrl = new URL(process.env.DATABASE_URL!);
if (!["localhost", "127.0.0.1"].includes(baseUrl.hostname)) {
  throw new Error("Refusing to run: DATABASE_URL is not a local database.");
}
const scratchUrl = new URL(baseUrl.toString());
scratchUrl.pathname = `/${SCRATCH_DB}`;
const pgArgs = [
  "-h", baseUrl.hostname,
  "-p", baseUrl.port || "5432",
  ...(baseUrl.username ? ["-U", decodeURIComponent(baseUrl.username)] : []),
];
const pgEnv = { ...process.env, PGPASSWORD: decodeURIComponent(baseUrl.password) };
const childEnv = { ...process.env, DATABASE_URL: scratchUrl.toString() };
const run = (cmd: string, args: string[], env = childEnv) =>
  execFileSync(cmd, args, { env, stdio: "pipe", cwd: process.cwd() });

// --- Hand key, from nobeldata.md's 2025 rows / summaries -------------------
// [text fragment, correct option label, points]. Points are 20 / (years the
// option occurred in 2006-2025), rounded to 3 places, worked out by hand:
// 20/13=1.538, 20/14=1.429, 20/11=1.818, 20/19=1.053, 20/15=1.333,
// 20/18=1.111, 20/17=1.176, 20/16=1.25, 20/10=2, 20/8=2.5, 20/8=2.5, 20/4=5.
type Key = { id: string; fragment: string; label: string; points: number; auto: boolean };
const KEY: Key[] = [
  { id: "phys_count", fragment: "share the Physics prize", label: "3 laureates", points: 1.538, auto: true },
  { id: "phys_phrase", fragment: "Physics motivation start", label: "Yes", points: 2, auto: true },
  { id: "chem_count", fragment: "share the Chemistry prize", label: "3 laureates", points: 1.429, auto: true },
  { id: "chem_phrase", fragment: "Chemistry motivation start", label: "Yes", points: 2.5, auto: true },
  { id: "med_count", fragment: "share the Physiology or Medicine prize", label: "3 laureates", points: 1.818, auto: true },
  { id: "med_discover", fragment: "Medicine motivation contain", label: "Yes", points: 1.053, auto: true },
  { id: "econ_count", fragment: "share the Economic Sciences prize", label: "3 laureates", points: 2.5, auto: true },
  { id: "econ_mit", fragment: "affiliated with MIT", label: "No", points: 1.333, auto: true },
  { id: "lit_genre", fragment: "primary genre", label: "Prose", points: 1.333, auto: false },
  { id: "lit_us", fragment: "Literature laureate be a US citizen", label: "No", points: 1.111, auto: false },
  { id: "peace_split", fragment: "individual(s), organisation(s)", label: "Individual(s) only", points: 1.818, auto: true },
  { id: "peace_us", fragment: "Peace laureate be a US citizen", label: "No", points: 1.176, auto: false },
  { id: "ww_female", fragment: "female laureates", label: "2", points: 5, auto: true },
  { id: "ww_age", fragment: "average age", label: "No", points: 1.111, auto: true },
  { id: "ww_africa", fragment: "residing in Africa", label: "No", points: 1.25, auto: true },
  // At most 6 of the 2025 laureates can be US citizens even on the most
  // generous reading (Clarke, Devoret, Martinis, Brunkow, Ramsdell, Mokyr).
  { id: "ww_us", fragment: "American citizens", label: "6 or fewer", points: 1.818, auto: false },
];
const keyById = new Map(KEY.map((k) => [k.id, k]));

// Users: which questions each answers, and how. "wrong" = an option other
// than the correct one. Expected totals are summed by hand below.
const wrongLabel: Record<string, string> = {
  phys_phrase: "No — something else",
  peace_split: "Organisation(s) only",
  ww_female: "0",
};
const ALL_IDS = KEY.map((k) => k.id);
const USERS = [
  // Every answer right: sum of all sixteen point values.
  { name: "Ada", correct: ALL_IDS, wrong: [] as string[], expected: 28.788 },
  // Right on the four laureate-count questions, wrong on two others,
  // silent on the rest: 1.538 + 1.429 + 1.818 + 2.5.
  { name: "Ben", correct: ["phys_count", "chem_count", "med_count", "econ_count"], wrong: ["peace_split", "ww_female"], expected: 7.285 },
  // Right on Literature, Peace and the four whole-week questions:
  // 1.333+1.111+1.818+1.176+5+1.111+1.25+1.818.
  { name: "Cleo", correct: ["lit_genre", "lit_us", "peace_split", "peace_us", "ww_female", "ww_age", "ww_africa", "ww_us"], wrong: [], expected: 14.617 },
  // Changes their mind on the female-count question before the deadline
  // (0 first, then 2) and answers Physics phrase wrong: 5 + 0.
  { name: "Dev", correct: ["ww_female"], wrong: ["phys_phrase"], expected: 5, changedMind: "ww_female" },
  // Never answers anything: must not appear on the leaderboard.
  { name: "Eve", correct: [], wrong: [], expected: 0 },
];

// Real 2025 announcement instants (UTC), Stockholm being CEST in October.
const ANNOUNCE_2025: Record<string, string> = {
  MEDICINE: "2025-10-06T09:30:00Z",
  PHYSICS: "2025-10-07T09:45:00Z",
  CHEMISTRY: "2025-10-08T09:45:00Z",
  LITERATURE: "2025-10-09T11:00:00Z",
  PEACE: "2025-10-10T09:00:00Z",
  ECONOMICS: "2025-10-13T09:45:00Z",
};
const MIN = 60 * 1000;

async function main() {
  try {
    execFileSync("dropdb", [...pgArgs, "--if-exists", SCRATCH_DB], { env: pgEnv, stdio: "pipe" });
    execFileSync("createdb", [...pgArgs, SCRATCH_DB], { env: pgEnv, stdio: "pipe" });
    run("npx", ["prisma", "migrate", "deploy"]);
    run("npx", ["prisma", "db", "seed"]);
    log("scratch database created, migrated and seeded with the 2026 questions", true);

    process.env.DATABASE_URL = scratchUrl.toString();
    const { prisma } = await import("../src/lib/prisma.ts");
    const { hashPassword } = await import("../src/lib/auth/password.ts");
    const { runSchedulerTick } = await import("../src/lib/scraping/scheduler.ts");
    const { computeLeaderboard } = await import("../src/lib/quiz/leaderboard.ts");
    const { getQuizPageData } = await import("../src/lib/quiz/getQuizData.ts");

    try {
      // --- Load the seeded questions, map to the hand key ----------------
      const questions = await prisma.question.findMany({ include: { options: true, prize: true } });
      const qByKey = new Map<string, (typeof questions)[number]>();
      for (const k of KEY) {
        const matches = questions.filter((q) => q.text.includes(k.fragment));
        if (matches.length !== 1) throw new Error(`key ${k.id}: ${matches.length} matching questions`);
        qByKey.set(k.id, matches[0]);
      }
      log("all 16 seeded questions map one-to-one onto the hand answer key", qByKey.size === 16 && questions.length === 16);

      // --- Users and answers, made while the game was still "open" -------
      const userIds = new Map<string, string>();
      for (const u of USERS) {
        const created = await prisma.user.create({
          data: {
            email: `dryrun-${u.name.toLowerCase()}@example.com`,
            passwordHash: await hashPassword("correct-horse-battery-staple"),
            displayName: `Dryrun ${u.name}`,
            emailVerified: true,
          },
        });
        userIds.set(u.name, created.id);
        const pick = async (id: string, label: string) => {
          const q = qByKey.get(id)!;
          const opt = q.options.find((o) => o.label === label);
          if (!opt) throw new Error(`no option "${label}" on ${id}`);
          await prisma.submission.upsert({
            where: { userId_questionId: { userId: created.id, questionId: q.id } },
            update: { answerOptionId: opt.id },
            create: { userId: created.id, questionId: q.id, answerOptionId: opt.id },
          });
        };
        if ("changedMind" in u) await pick(u.changedMind as string, "0");
        for (const id of u.correct) await pick(id, keyById.get(id)!.label);
        for (const id of u.wrong) await pick(id, wrongLabel[id]);
      }

      // --- Time travel: move the whole game to the 2025 dates -----------
      for (const [key, iso] of Object.entries(ANNOUNCE_2025)) {
        await prisma.prizeCategory.update({ where: { key: key as never }, data: { announcementAt: new Date(iso) } });
        await prisma.question.updateMany({
          where: { prize: { key: key as never } },
          data: { answerDeadline: new Date(iso) },
        });
      }
      await prisma.question.updateMany({
        where: { scope: "WHOLE_WEEK" },
        data: { answerDeadline: new Date(ANNOUNCE_2025.PHYSICS) },
      });

      // --- Scheduler: 2 minutes after the first announcement -> nothing --
      const medicine = new Date(ANNOUNCE_2025.MEDICINE).getTime();
      await runSchedulerTick(new Date(medicine + 2 * MIN));
      const attemptsEarly = await prisma.result.aggregate({ _sum: { scrapeAttempts: true } });
      log("2 minutes after the first announcement the scheduler makes no attempt", (attemptsEarly._sum.scrapeAttempts ?? 0) === 0);

      // --- Scheduler: after the last announcement, everything is due -----
      const econ = new Date(ANNOUNCE_2025.ECONOMICS).getTime();
      await runSchedulerTick(new Date(econ + 6 * MIN));
      const results = await prisma.result.findMany({ include: { correctAnswerOption: true } });
      const resultByQuestion = new Map(results.map((r) => [r.questionId, r]));

      const autoKeys = KEY.filter((k) => k.auto);
      let allMatch = true;
      for (const k of autoKeys) {
        const r = resultByQuestion.get(qByKey.get(k.id)!.id);
        const ok = r?.status === "PROPOSED" && r.correctAnswerOption?.label === k.label;
        if (!ok) allMatch = false;
        log(`scraper proposes "${k.label}" for ${k.id}`, ok, `got ${r?.status} / ${r?.correctAnswerOption?.label}`);
      }
      log(`all ${autoKeys.length} auto-gradable proposals equal the hand key`, allMatch);

      const manualKeys = KEY.filter((k) => !k.auto);
      log(
        "the 4 citizenship/genre questions get no proposal (admin-only)",
        manualKeys.every((k) => (resultByQuestion.get(qByKey.get(k.id)!.id)?.status ?? "PENDING") === "PENDING")
      );

      log("nothing is live before admin approval (leaderboard empty)", (await computeLeaderboard()).length === 0);

      // --- Admin approves everything, each on its own announcement day ---
      // (whole-week questions once the last prize was in). Same fields the
      // approveResult server action writes; the browser flow itself is
      // covered by verify-phase6-admin.ts.
      for (const k of KEY) {
        const q = qByKey.get(k.id)!;
        const opt = q.options.find((o) => o.label === k.label)!;
        const day = q.prize ? new Date(ANNOUNCE_2025[q.prize.key]) : new Date(ANNOUNCE_2025.ECONOMICS);
        const approvedAt = new Date(day.getTime() + 60 * MIN);
        await prisma.result.upsert({
          where: { questionId: q.id },
          update: { correctAnswerOptionId: opt.id, noneMatched: false, status: "APPROVED", approvedAt },
          create: { questionId: q.id, correctAnswerOptionId: opt.id, noneMatched: false, status: "APPROVED", approvedAt },
        });
      }

      // --- Scores vs hand computation ------------------------------------
      const board = await computeLeaderboard();
      const byName = new Map(board.map((e) => [e.displayName, e]));
      for (const u of USERS) {
        const entry = byName.get(`Dryrun ${u.name}`);
        if (u.expected === 0) {
          log(`${u.name} (no answers) is not on the leaderboard`, !entry);
        } else {
          log(
            `${u.name}'s total equals the hand computation`,
            !!entry && Math.abs(entry.totalPoints - u.expected) < 1e-9,
            `leaderboard ${entry?.totalPoints} vs hand ${u.expected}`
          );
        }
      }
      log(
        "ranking is Ada, Cleo, Ben, Dev",
        board.map((e) => e.displayName).join(",") === "Dryrun Ada,Dryrun Cleo,Dryrun Ben,Dryrun Dev",
        board.map((e) => `${e.rank}:${e.displayName}`).join(" ")
      );
      log("no points count as 'today' for a game that ended in 2025", board.every((e) => e.todayPoints === 0));

      // --- Player-facing view agrees with the leaderboard ----------------
      for (const u of USERS.filter((x) => x.expected > 0)) {
        const view = await getQuizPageData(userIds.get(u.name)!);
        const sum = view.reduce((acc, q) => acc + (q.pointsEarned ?? 0), 0);
        log(
          `${u.name}'s per-question points on the quiz page sum to the hand total`,
          Math.abs(sum - u.expected) < 1e-9,
          `${sum} vs ${u.expected}`
        );
      }
      const dev = await getQuizPageData(userIds.get("Dev")!);
      const devFemale = dev.find((q) => q.id === qByKey.get("ww_female")!.id)!;
      const devTwo = qByKey.get("ww_female")!.options.find((o) => o.label === "2")!;
      log("Dev's changed-before-deadline answer is the one that was scored", devFemale.userAnswerOptionId === devTwo.id);
    } finally {
      await prisma.$disconnect();
    }
  } finally {
    if (!process.env.KEEP_DB) {
      try {
        execFileSync("dropdb", [...pgArgs, "--if-exists", SCRATCH_DB], { env: pgEnv, stdio: "pipe" });
      } catch {
        // connections may linger a moment; the next run drops it first anyway
      }
    }
  }
}

main().catch((e) => {
  console.error(e.stderr?.toString() || e);
  process.exitCode = 1;
});
