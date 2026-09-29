import "dotenv/config";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { chromium, type Page } from "playwright";

// TASKS.md 10.2: several accounts answer, change answers and read the
// leaderboard at the same time, in real browsers against a real Next server.
// Runs against a throwaway database (nobel_quiz_e2e_conc) and its own
// `next dev` on port 3112, both created and torn down here, so neither the
// dev data nor a dev server you already have running is disturbed.
// Set KEEP_DB=1 to keep the database for inspection.

function log(step: string, ok: boolean, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"} - ${step}${extra ? ": " + extra : ""}`);
  if (!ok) process.exitCode = 1;
}

const SCRATCH_DB = "nobel_quiz_e2e_conc";
const PORT = 3112;
const BASE = `http://localhost:${PORT}`;
const PASSWORD = "correct-horse-battery-staple";
const USER_COUNT = 8;

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
const childEnv = { ...process.env, DATABASE_URL: scratchUrl.toString(), RESEND_API_KEY: "" };

async function waitForServer(server: ChildProcess) {
  for (let i = 0; i < 120; i++) {
    if (server.exitCode !== null) throw new Error("next dev exited early");
    try {
      const res = await fetch(`${BASE}/login`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("next dev did not start in time");
}

async function main() {
  let server: ChildProcess | null = null;
  try {
    execFileSync("dropdb", [...pgArgs, "--if-exists", SCRATCH_DB], { env: pgEnv, stdio: "pipe" });
    execFileSync("createdb", [...pgArgs, SCRATCH_DB], { env: pgEnv, stdio: "pipe" });
    execFileSync("npx", ["prisma", "migrate", "deploy"], { env: childEnv, stdio: "pipe" });
    execFileSync("npx", ["prisma", "db", "seed"], { env: childEnv, stdio: "pipe" });

    process.env.DATABASE_URL = scratchUrl.toString();
    const { prisma } = await import("../src/lib/prisma.ts");
    const { hashPassword } = await import("../src/lib/auth/password.ts");

    server = spawn("npx", ["next", "dev", "-p", String(PORT)], { env: childEnv, stdio: "pipe" });
    await waitForServer(server);
    log("scratch database seeded and Next server up on its own port", true);

    const browser = await chromium.launch();
    try {
      const questions = await prisma.question.findMany({
        include: { options: { orderBy: { sortOrder: "asc" } } },
        orderBy: { id: "asc" },
      });
      const N = questions.length;

      const users = [];
      for (let i = 0; i < USER_COUNT; i++) {
        users.push(
          await prisma.user.create({
            data: {
              email: `conc-${i}@example.com`,
              passwordHash: await hashPassword(PASSWORD),
              displayName: `Concurrent ${i}`,
              emailVerified: true,
            },
          })
        );
      }

      // The answer each user should end up with, decided up front so it can
      // be checked without asking the app: a first pick, and for the first
      // four questions a changed mind. Different users deliberately pick
      // differently so a mix-up between accounts can't go unnoticed.
      const firstPick = (u: number, q: number) => (u + q) % questions[q].options.length;
      const changedPick = (u: number, q: number) => (firstPick(u, q) + 1) % questions[q].options.length;
      const finalPick = (u: number, q: number) => (q < 4 ? changedPick(u, q) : firstPick(u, q));

      const pages: Page[] = [];
      for (let i = 0; i < USER_COUNT; i++) {
        pages.push(await (await browser.newContext()).newPage());
      }

      const login = async (page: Page, i: number) => {
        await page.goto(`${BASE}/login`);
        await page.fill('input[name="email"]', `conc-${i}@example.com`);
        await page.fill('input[name="password"]', PASSWORD);
        await page.click('button[type="submit"]');
        await page.waitForURL(`${BASE}/`);
      };
      await Promise.all(pages.map(login));
      log(`${USER_COUNT} accounts logged in simultaneously`, true);

      const formFor = (page: Page, q: number) =>
        page.locator(`form:has(input[name="questionId"][value="${questions[q].id}"])`);

      const answer = async (page: Page, q: number, option: number) => {
        const form = formFor(page, q);
        await form.locator('input[type="radio"]').nth(option).check();
        const saved = page.waitForResponse((r) => r.request().method() === "POST");
        await form.locator('button[type="submit"]').click();
        await saved;
        await form.locator('button:has-text("Saving")').waitFor({ state: "detached" });
      };

      // Everyone answers all questions and changes their mind on the first
      // four, all at once — while one extra visitor keeps reloading the
      // page (and leaderboard) throughout.
      let readerRunning = true;
      let readerLoads = 0;
      let readerErrors = 0;
      const reader = (async () => {
        const ctx = await browser.newContext();
        const p = await ctx.newPage();
        await login(p, USER_COUNT - 1);
        while (readerRunning) {
          const res = await p.reload();
          readerLoads++;
          if (!res || !res.ok()) readerErrors++;
        }
        await ctx.close();
      })();

      await Promise.all(
        pages.map(async (page, u) => {
          for (let q = 0; q < N; q++) await answer(page, q, firstPick(u, q));
          for (let q = 0; q < 4; q++) await answer(page, q, changedPick(u, q));
        })
      );
      readerRunning = false;
      await reader;
      log(`a reader reloaded the page ${readerLoads} times during the storm without a failed response`, readerLoads > 0 && readerErrors === 0);

      // --- Attribution in the database ---------------------------------
      const rows = await prisma.submission.findMany();
      log(`exactly one submission per user per question (${USER_COUNT}x${N})`, rows.length === USER_COUNT * N);
      let misattributed = 0;
      for (let u = 0; u < USER_COUNT; u++) {
        for (let q = 0; q < N; q++) {
          const row = rows.find((r) => r.userId === users[u].id && r.questionId === questions[q].id);
          if (row?.answerOptionId !== questions[q].options[finalPick(u, q)].id) misattributed++;
        }
      }
      log("every stored answer is the final pick of the user who made it", misattributed === 0, `${misattributed} mismatches`);

      // --- Attribution as each user sees it after a reload -----------------
      let uiMismatches = 0;
      await Promise.all(
        pages.map(async (page, u) => {
          await page.reload();
          for (let q = 0; q < N; q++) {
            const checked = await formFor(page, q).locator('input[type="radio"]').evaluateAll(
              (els) => els.findIndex((el) => (el as HTMLInputElement).checked)
            );
            if (checked !== finalPick(u, q)) uiMismatches++;
          }
        })
      );
      log("every user's page shows their own answers, no one else's", uiMismatches === 0, `${uiMismatches} mismatches`);

      // --- Same user, same question, two tabs at the same instant -----------
      const dupUser = 0;
      const dupQ = 5;
      const ctx2 = await browser.newContext({ storageState: await pages[dupUser].context().storageState() });
      const tab2 = await ctx2.newPage();
      await tab2.goto(`${BASE}/`);
      const tab1 = pages[dupUser];
      const optA = (finalPick(dupUser, dupQ) + 1) % questions[dupQ].options.length;
      const optB = (finalPick(dupUser, dupQ) + 2) % questions[dupQ].options.length;
      await Promise.all([answer(tab1, dupQ, optA), answer(tab2, dupQ, optB)]);
      const dupRows = await prisma.submission.findMany({
        where: { userId: users[dupUser].id, questionId: questions[dupQ].id },
      });
      const landed = dupRows[0]?.answerOptionId;
      log(
        "two simultaneous submissions from one user leave exactly one row holding one of the two answers",
        dupRows.length === 1 &&
          (landed === questions[dupQ].options[optA].id || landed === questions[dupQ].options[optB].id)
      );
      // Settle on a known answer so the expected totals below stay exact.
      await answer(tab1, dupQ, finalPick(dupUser, dupQ));
      await ctx2.close();

      // --- Grade everything (first option correct), then compare totals ------
      const approvedAt = new Date();
      for (const q of questions) {
        await prisma.result.upsert({
          where: { questionId: q.id },
          update: { correctAnswerOptionId: q.options[0].id, noneMatched: false, status: "APPROVED", approvedAt },
          create: { questionId: q.id, correctAnswerOptionId: q.options[0].id, noneMatched: false, status: "APPROVED", approvedAt },
        });
      }
      // Expected totals come from the pick table and the seeded point
      // values, not from the app's own aggregation.
      const expectedTotal = users.map((_, u) => {
        let sum = 0;
        for (let q = 0; q < N; q++) {
          if (finalPick(u, q) === 0) sum += questions[q].options[0].points.toNumber();
        }
        return Math.round(sum * 1000) / 1000;
      });

      const seen = await Promise.all(
        pages.map(async (page) => {
          await page.reload();
          const rowsText = await page.locator("table").first().locator("tbody tr").evaluateAll((trs) =>
            trs.map((tr) => Array.from(tr.querySelectorAll("th, td")).map((c) => (c.textContent ?? "").trim()))
          );
          return rowsText;
        })
      );

      let boardConsistent = true;
      let ownRowRight = true;
      for (let u = 0; u < USER_COUNT; u++) {
        const table = seen[u];
        const totals = new Map<string, number>();
        for (const cells of table) {
          if (cells.length === 4) totals.set(cells[1].replace(/\s*\(you\)\s*$/, "").trim(), Number(cells[3]));
        }
        // Compare by display name: "Concurrent {i}" carries the expected value.
        for (let v = 0; v < USER_COUNT; v++) {
          const shown = [...totals.entries()].find(([name]) => name.includes(`Concurrent ${v}`))?.[1];
          if (expectedTotal[v] > 0 && shown !== expectedTotal[v]) boardConsistent = false;
        }
        const own = table.find((cells) => cells[1]?.includes("(you)"));
        if (expectedTotal[u] > 0 && Number(own?.[3]) !== expectedTotal[u]) ownRowRight = false;
      }
      log("each user's own '(you)' leaderboard row shows their hand-derived total", ownRowRight, expectedTotal.join(", "));
      log("all eight browsers see the same, correct total for every player", boardConsistent);

      const todaySum = seen[0].filter((c) => c.length === 4).reduce((a, c) => a + Number(c[2]), 0);
      const totalSum = expectedTotal.reduce((a, b) => a + b, 0);
      log(
        "sum of the visible top-ten 'today' points equals the sum of everyone's expected total (all approved today)",
        Math.abs(todaySum - totalSum) < 1e-6,
        `${todaySum} vs ${totalSum}`
      );
    } finally {
      await browser.close();
      await prisma.$disconnect();
    }
  } finally {
    if (server) {
      server.kill("SIGTERM");
      await new Promise((r) => setTimeout(r, 1500));
    }
    if (!process.env.KEEP_DB) {
      try {
        execFileSync("dropdb", [...pgArgs, "--if-exists", SCRATCH_DB], { env: pgEnv, stdio: "pipe" });
      } catch {
        // next run drops it first
      }
    }
  }
}

main().catch((e) => {
  console.error(e.stderr?.toString() || e);
  process.exitCode = 1;
});
