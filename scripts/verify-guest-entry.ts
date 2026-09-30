import "dotenv/config";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { chromium, type Page } from "playwright";

// Guest entries (METHODS.md, "Guest entries"): a visitor with no account picks
// a name, answers the open questions once, and has no way to change them
// afterwards. Real browsers against a real Next server on a throwaway database
// (nobel_quiz_e2e_guest, port 3113), both created and torn down here.
// Set KEEP_DB=1 to keep the database for inspection.

function log(step: string, ok: boolean, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"} - ${step}${extra ? ": " + extra : ""}`);
  if (!ok) process.exitCode = 1;
}

const SCRATCH_DB = "nobel_quiz_e2e_guest";
const PORT = 3113;
const BASE = `http://localhost:${PORT}`;

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
      if ((await fetch(`${BASE}/play`)).ok) return;
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
    const { computeLeaderboard } = await import("../src/lib/quiz/leaderboard.ts");
    const { LAUREATES } = await import("../src/lib/auth/laureateNames.ts");

    server = spawn("npx", ["next", "dev", "-p", String(PORT)], { env: childEnv, stdio: "pipe" });
    await waitForServer(server);
    log("scratch database seeded and Next server up on its own port", true);

    const questions = await prisma.question.findMany({
      include: { options: { orderBy: { sortOrder: "asc" } } },
      orderBy: { id: "asc" },
    });
    const totalRadios = questions.reduce((n, q) => n + q.options.length, 0);
    const registered = await prisma.user.create({
      data: {
        email: "registered@example.com",
        passwordHash: await hashPassword("correct-horse-battery-staple"),
        displayName: "Reg Player",
        emailVerified: true,
      },
    });

    const browser = await chromium.launch();
    const fillAndSubmit = async (page: Page, name: string, picks: Record<number, number>) => {
      await page.fill('input[name="displayName"]', name);
      for (const [q, o] of Object.entries(picks)) {
        await page.locator(`input[name="q_${questions[+q].id}"]`).nth(o).check();
      }
      await page.click('button[type="submit"]');
    };
    const errorText = async (page: Page) =>
      (await page.locator('p[role="alert"]').first().textContent({ timeout: 10_000 })) ?? "";

    try {
      // --- Guest A: happy path -------------------------------------------
      const ctxA = await browser.newContext();
      const a = await ctxA.newPage();
      await a.goto(`${BASE}/`);
      log("home page offers the guest route", (await a.locator('a[href="/play"]').count()) === 1);

      await a.goto(`${BASE}/play`);
      log("guest form lists every open question's options", (await a.locator('input[type="radio"]').count()) === totalRadios);
      log("no email/password fields on the guest form", (await a.locator('input[type="email"], input[type="password"]').count()) === 0);

      const picksA = { 0: 0, 1: 1, 4: 0 };
      await fillAndSubmit(a, "Guesty Guest", picksA);
      await a.waitForURL(/\/guest\/.+/);
      const tokenA = a.url().split("/guest/")[1];
      log("submitting lands on a private /guest/<token> page", tokenA.length >= 40);

      const guestA = await prisma.guestPlayer.findUniqueOrThrow({
        where: { token: tokenA },
        include: { submissions: true },
      });
      const expectedA = Object.entries(picksA)
        .map(([q, o]) => `${questions[+q].id}:${questions[+q].options[o].id}`)
        .sort();
      const storedA = guestA.submissions.map((s) => `${s.questionId}:${s.answerOptionId}`).sort();
      log("stored answers are exactly the picks made", JSON.stringify(expectedA) === JSON.stringify(storedA), `${storedA.length} rows`);

      const body = (await a.locator("main").textContent()) ?? "";
      log("page shows the name and the chosen answers", body.includes("Guesty Guest") && body.includes(questions[0].options[0].label));
      log("page has NO answer inputs and no submit/update buttons", (await a.locator('main input[type="radio"]').count()) === 0 && !/Submit answer|Update answer/.test(body));
      const forms = await a.locator("main form").count();
      const formButtons = await a.locator("main form button").allTextContents();
      log("the only form on the page is 'Delete my entry'", forms === 1 && formButtons.join() === "Delete my entry");

      await a.goto(`${BASE}/play`);
      log("revisiting /play bounces to the existing entry", a.url() === `${BASE}/guest/${tokenA}`);
      await a.goto(`${BASE}/`);
      log("home page links back to the entry instead of offering another", (await a.locator(`a[href="/guest/${tokenA}"]`).count()) === 1 && (await a.locator('a[href="/play"]').count()) === 0);
      log("no second entry was created by those visits", (await prisma.guestPlayer.count()) === 1);

      // --- Guest B: every rejection, then a valid entry -------------------
      const ctxB = await browser.newContext();
      const b = await ctxB.newPage();
      const fresh = async () => b.goto(`${BASE}/play`);

      await fresh();
      await fillAndSubmit(b, "guesty GUEST", { 0: 1 });
      log("name clash with another guest (case-insensitive) is rejected", (await errorText(b)).includes("already taken"));

      await fresh();
      await fillAndSubmit(b, "reg player", { 0: 1 });
      log("name clash with a registered user is rejected", (await errorText(b)).includes("already taken"));

      await fresh();
      await fillAndSubmit(b, LAUREATES[0].name, { 0: 1 });
      log("a handed-out laureate name is rejected", (await errorText(b)).toLowerCase().includes("laureate"));

      await fresh();
      await fillAndSubmit(b, "No Answers", {});
      log("an entry with no answers is rejected", (await errorText(b)).includes("at least one"));

      await fresh();
      await b.fill('input[name="displayName"]', "Bot Name");
      await b.locator('input[name="website"]').evaluate((el) => ((el as HTMLInputElement).value = "http://spam"));
      await b.locator(`input[name="q_${questions[0].id}"]`).first().check();
      await b.click('button[type="submit"]');
      await b.waitForURL(`${BASE}/`);
      log("honeypot-filled submission is dropped", (await prisma.guestPlayer.count()) === 1);

      // Deadline passes while the form is open: the server must refuse.
      await fresh();
      const victim = questions[0];
      const originalDeadline = victim.answerDeadline;
      await prisma.question.update({ where: { id: victim.id }, data: { answerDeadline: new Date(Date.now() - 60_000) } });
      await fillAndSubmit(b, "Too Late", { 0: 0 });
      log("an answer to a question that just closed is rejected server-side", (await errorText(b)).includes("deadline"));
      log("...and no entry was stored", (await prisma.guestPlayer.count()) === 1);
      await prisma.question.update({ where: { id: victim.id }, data: { answerDeadline: originalDeadline } });

      await fresh();
      const picksB = { 0: 1, 1: 0 };
      await fillAndSubmit(b, "Second Guest", picksB);
      await b.waitForURL(/\/guest\/.+/);
      const tokenB = b.url().split("/guest/")[1];
      log("a second person in a different browser can enter", tokenB !== tokenA && (await prisma.guestPlayer.count()) === 2);

      // --- Scoring: guests and registered users share one board ------------
      const q0 = questions[0];
      const correct = q0.options[picksA[0]];
      await prisma.submission.create({ data: { userId: registered.id, questionId: q0.id, answerOptionId: correct.id } });
      await prisma.question.update({ where: { id: q0.id }, data: { answerDeadline: new Date(Date.now() - 60_000) } });
      await prisma.result.upsert({
        where: { questionId: q0.id },
        update: { correctAnswerOptionId: correct.id, noneMatched: false, status: "APPROVED", approvedAt: new Date() },
        create: { questionId: q0.id, correctAnswerOptionId: correct.id, noneMatched: false, status: "APPROVED", approvedAt: new Date() },
      });
      const points = correct.points.toNumber();
      const board = await computeLeaderboard();
      const byName = new Map(board.map((e) => [e.displayName, e]));
      log("guest with the right answer scores the option's points", byName.get("Guesty Guest")?.totalPoints === points, `${byName.get("Guesty Guest")?.totalPoints} vs ${points}`);
      log("guest with the wrong answer scores 0", byName.get("Second Guest")?.totalPoints === 0);
      log("registered user with the same answer ties with the guest on one board", byName.get("Reg Player")?.totalPoints === points && byName.get("Reg Player")?.rank === byName.get("Guesty Guest")?.rank);

      await a.goto(`${BASE}/guest/${tokenA}`);
      const boardText = (await a.locator("main table").textContent()) ?? "";
      log("guest page shows them on the leaderboard as '(you)' next to registered players", boardText.includes("Guesty Guest (you)") && boardText.includes("Reg Player"));
      log("graded card shows the points earned", ((await a.locator("main").textContent()) ?? "").includes(`Points earned: ${points}`));
      log("graded question is still read-only", (await a.locator('main input[type="radio"]').count()) === 0);

      // --- Privacy: the URL is the key, and entries can be deleted ---------
      const missing = await a.goto(`${BASE}/guest/not-a-real-token`);
      log("an unknown token is a 404", missing?.status() === 404);
      await a.goto(`${BASE}/guest/${tokenA}`);
      await a.click('button:has-text("Delete my entry")');
      await a.waitForURL(`${BASE}/`);
      log("deleting removes the guest and all answers", (await prisma.guestPlayer.count({ where: { token: tokenA } })) === 0 && (await prisma.guestSubmission.count({ where: { guestId: guestA.id } })) === 0);
      const gone = await a.goto(`${BASE}/guest/${tokenA}`);
      log("the old private link is dead afterwards", gone?.status() === 404);
      await a.goto(`${BASE}/`);
      log("the browser is offered the guest route again", (await a.locator('a[href="/play"]').count()) === 1);
      log("the other guest's entry is untouched", (await prisma.guestSubmission.count()) === Object.keys(picksB).length);
    } finally {
      await browser.close();
      await prisma.$disconnect();
    }
  } finally {
    server?.kill("SIGTERM");
    if (!process.env.KEEP_DB) {
      await new Promise((r) => setTimeout(r, 1500));
      try {
        execFileSync("dropdb", [...pgArgs, "--if-exists", SCRATCH_DB], { env: pgEnv, stdio: "pipe" });
      } catch {
        console.warn(`could not drop ${SCRATCH_DB}; drop it by hand`);
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
