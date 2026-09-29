import "dotenv/config";
import { chromium } from "playwright";
import { prisma } from "../src/lib/prisma.ts";
import { latestVerificationToken } from "./testHelpers.ts";

const BASE = "http://localhost:3000";

function log(step: string, ok: boolean, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"} - ${step}${extra ? ": " + extra : ""}`);
  if (!ok) process.exitCode = 1;
}

async function main() {
  // --- DB setup ---
  const physics = await prisma.question.findFirstOrThrow({
    where: { text: { contains: "share the Physics prize" } },
  });
  await prisma.question.update({
    where: { id: physics.id },
    data: { answerDeadline: new Date(Date.now() - 60 * 60 * 1000) },
  });

  const chemistry = await prisma.question.findFirstOrThrow({
    where: { text: { contains: "share the Chemistry prize" } },
    include: { options: true },
  });
  const chemistryCorrectOption = chemistry.options.find((o) => o.label === "3 laureates")!;
  await prisma.question.update({
    where: { id: chemistry.id },
    data: { answerDeadline: new Date(Date.now() - 60 * 60 * 1000) },
  });
  await prisma.result.upsert({
    where: { questionId: chemistry.id },
    update: {
      correctAnswerOptionId: chemistryCorrectOption.id,
      noneMatched: false,
      status: "APPROVED",
      approvedAt: new Date(),
    },
    create: {
      questionId: chemistry.id,
      correctAnswerOptionId: chemistryCorrectOption.id,
      noneMatched: false,
      status: "APPROVED",
      approvedAt: new Date(),
    },
  });

  const peace = await prisma.question.findFirstOrThrow({
    where: { text: { contains: "individual(s), organisation(s)" } },
    include: { options: true },
  });
  const peaceIndividualOption = peace.options.find((o) => o.label === "Individual(s) only")!;
  await prisma.question.update({
    where: { id: peace.id },
    data: { answerDeadline: new Date(Date.now() + 10 * 60 * 1000) },
  });
  await prisma.result.deleteMany({ where: { questionId: peace.id } });

  const literature = await prisma.question.findFirstOrThrow({
    where: { text: { contains: "primary genre" } },
  });

  const economics = await prisma.prizeCategory.findUniqueOrThrow({ where: { key: "ECONOMICS" } });
  const economicsQuestions = await prisma.question.findMany({
    where: { prizeId: economics.id },
    include: { options: true },
  });

  // --- Browser flow ---
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const email = `delivered+phase4-${Date.now()}@resend.dev`;
  const password = "correct-horse-battery-staple";

  await page.goto(`${BASE}/signup`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.fill('input[name="confirmPassword"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/signup/check-email`);

  const verifyToken = await latestVerificationToken(email);
  await page.goto(`${BASE}/verify?token=${verifyToken}`);

  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`);

  // --- 4.1 / 4.3: sections render with the right question in each ---
  const physicsSection = page.locator("text=Voting closed. Waiting for the result.");
  log("awaiting-result question shows the 'waiting' message", await physicsSection.count() === 1);

  const chemistryCorrectText = page.locator("text=Correct answer: 3 laureates");
  log("graded question shows the correct answer", await chemistryCorrectText.count() === 1);

  const chemistryPointsText = page.locator("text=Points earned: 0").first();
  log(
    "graded question shows 0 points for a user who never submitted",
    await chemistryPointsText.count() >= 1
  );

  // --- 4.2: submit an answer to an open question, confirm it persists ---
  const peaceForm = page.locator("form", { hasText: "individual(s), organisation(s)" });
  await peaceForm.locator(`input[value="${peaceIndividualOption.id}"]`).check();
  await peaceForm.locator('button[type="submit"]').click();
  await page.waitForTimeout(500);

  await page.reload();
  const peaceFormAfterReload = page.locator("form", { hasText: "individual(s), organisation(s)" });
  const isChecked = await peaceFormAfterReload
    .locator(`input[value="${peaceIndividualOption.id}"]`)
    .isChecked();
  log("submitted answer persists across reload", isChecked);

  // --- 5.1 (via the UI): noneMatched fallback awards a submitter 1 point ---
  await prisma.result.upsert({
    where: { questionId: peace.id },
    update: { correctAnswerOptionId: null, noneMatched: true, status: "APPROVED", approvedAt: new Date() },
    create: {
      questionId: peace.id,
      correctAnswerOptionId: null,
      noneMatched: true,
      status: "APPROVED",
      approvedAt: new Date(),
    },
  });
  await page.reload();
  const peacePointsText = page.locator("text=Points earned: 1");
  log("noneMatched fallback awards 1 point to a submitter, shown in the UI", await peacePointsText.count() === 1);

  // --- 4.4: leaderboard reflects the same total ---
  const leaderboardText = await page.locator("table").first().innerText();
  log(
    "leaderboard shows total points of 1 for the test user",
    /\b1\s+1\b/.test(leaderboardText.replace(/\n/g, " ")),
    leaderboardText.replace(/\n/g, " | ")
  );

  // --- 4.2: server-side deadline enforcement, even against an already-rendered stale form ---
  await prisma.question.update({
    where: { id: literature.id },
    data: { answerDeadline: new Date(Date.now() + 3000) },
  });
  await page.reload();
  const literatureForm = page.locator("form", { hasText: "primary genre" });
  log("literature question form is rendered while still open", (await literatureForm.count()) === 1);

  await page.waitForTimeout(4000); // let the deadline pass while the stale form is still loaded
  await literatureForm.locator('input[type="radio"]').first().check();
  await literatureForm.locator('button[type="submit"]').click();
  await page.waitForSelector("p[role=alert]");
  const staleFormError = await page.locator("p[role=alert]").textContent();
  log(
    "stale form submission after deadline is rejected server-side",
    /deadline.*passed/i.test(staleFormError ?? ""),
    staleFormError ?? ""
  );
  const literatureSubmission = await prisma.submission.findUnique({
    where: { userId_questionId: { userId: (await prisma.user.findUniqueOrThrow({ where: { email } })).id, questionId: literature.id } },
  });
  log("no submission row was created for the rejected answer", literatureSubmission === null);

  // --- 4.5: end-of-week view ---
  // isEndOfWeek() gates on the Economics questions' Result.approvedAt (all of
  // them, +24h), not PrizeCategory.announcementAt — see getQuizData.ts.
  const approvedAt = new Date(Date.now() - 48 * 60 * 60 * 1000);
  for (const q of economicsQuestions) {
    const correctOption = q.options[0];
    await prisma.question.update({
      where: { id: q.id },
      data: { answerDeadline: approvedAt },
    });
    await prisma.result.upsert({
      where: { questionId: q.id },
      update: {
        correctAnswerOptionId: correctOption.id,
        noneMatched: false,
        status: "APPROVED",
        approvedAt,
      },
      create: {
        questionId: q.id,
        correctAnswerOptionId: correctOption.id,
        noneMatched: false,
        status: "APPROVED",
        approvedAt,
      },
    });
  }
  await page.reload();
  const endOfWeekHeading = await page.textContent("h1");
  log(
    "end-of-week view replaces the quiz page after Economics + 24h",
    endOfWeekHeading === "Nobel Quiz — final results",
    endOfWeekHeading ?? ""
  );
  const ownAnswersHeading = page.locator("text=Your answers this year");
  log("logged-in user sees their own answer history in end-of-week view", (await ownAnswersHeading.count()) === 1);

  await browser.close();
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
