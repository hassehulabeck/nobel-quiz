import "dotenv/config";
import { chromium } from "playwright";
import { prisma } from "../src/lib/prisma.ts";
import { latestVerificationToken } from "./testHelpers.ts";

// TASKS.md 6.4's verify condition: "as the admin user, deliberately reject a
// proposed auto-grading, enter a correction, approve it, and confirm the
// player-facing pages (4.3) reflect the corrected result, not the original
// proposal." Also exercises 6.5's go-live gate along the way: before
// approval, the player-facing page must not show the (wrong) proposal at
// all, matching getQuizData.ts's existing approvedAt gate.

const BASE = "http://localhost:3000";

function log(step: string, ok: boolean, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"} - ${step}${extra ? ": " + extra : ""}`);
  if (!ok) process.exitCode = 1;
}

async function signupAndVerify(page: import("playwright").Page, email: string, password: string) {
  await page.goto(`${BASE}/signup`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.fill('input[name="confirmPassword"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/signup/check-email`);

  const verifyToken = await latestVerificationToken(email);
  await page.goto(`${BASE}/verify?token=${verifyToken}`);
  await page.click('button:has-text("Confirm my email")');
  await page.waitForURL(/\/verify\?result=/);
}

async function login(page: import("playwright").Page, email: string, password: string) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`);
}

async function main() {
  const password = "correct-horse-battery-staple";
  const playerEmail = `delivered+phase6-player-${Date.now()}@resend.dev`;
  const adminEmail = `delivered+phase6-admin-${Date.now()}@resend.dev`;

  // --- DB setup: a past-deadline question with a wrong PROPOSED result ---
  const medicine = await prisma.question.findFirstOrThrow({
    where: { text: { contains: "share the Physiology or Medicine prize" } },
    include: { options: true },
  });
  const wrongOption = medicine.options.find((o) => o.label === "1 (solo)")!;
  const correctOption = medicine.options.find((o) => o.label === "3 laureates")!;

  await prisma.question.update({
    where: { id: medicine.id },
    data: { answerDeadline: new Date(Date.now() - 60 * 60 * 1000) },
  });
  await prisma.result.upsert({
    where: { questionId: medicine.id },
    update: {
      correctAnswerOptionId: wrongOption.id,
      noneMatched: false,
      status: "PROPOSED",
      approvedAt: null,
      rawScrapedData: { note: "deliberately wrong fixture for verify-phase6-admin" },
    },
    create: {
      questionId: medicine.id,
      correctAnswerOptionId: wrongOption.id,
      noneMatched: false,
      status: "PROPOSED",
      rawScrapedData: { note: "deliberately wrong fixture for verify-phase6-admin" },
    },
  });

  const browser = await chromium.launch();

  // --- Player: a PROPOSED (unapproved) result must not show up yet (6.5) ---
  const playerPage = await browser.newPage();
  await signupAndVerify(playerPage, playerEmail, password);
  await login(playerPage, playerEmail, password);

  const awaitingText = playerPage.locator("text=Voting closed. Waiting for the result.");
  log(
    "6.5: an unapproved (PROPOSED) result shows no correct answer to players yet",
    (await awaitingText.count()) >= 1
  );
  const wrongAnswerLeak = playerPage.locator("text=Correct answer: 1 (solo)");
  log(
    "6.5: the wrong proposed answer is never shown to players before approval",
    (await wrongAnswerLeak.count()) === 0
  );

  // --- Admin: sign up, promote to admin directly in the DB (the documented one-off path) ---
  const adminPage = await browser.newPage();
  await signupAndVerify(adminPage, adminEmail, password);
  await prisma.user.update({
    where: { email: adminEmail },
    data: { isAdmin: true },
  });
  await login(adminPage, adminEmail, password);

  await adminPage.goto(`${BASE}/admin/results`);
  const medicineForm = adminPage.locator("form", {
    hasText: "share the Physiology or Medicine prize",
  });
  log("6.4: the admin page lists the question needing attention", (await medicineForm.count()) === 1);

  const proposedRadioChecked = await medicineForm
    .locator(`input[value="${wrongOption.id}"]`)
    .isChecked();
  log("6.4: the scraper's (wrong) proposal is pre-selected for review", proposedRadioChecked);

  // Deliberately reject the proposal: pick the correct option instead, then approve.
  await medicineForm.locator(`input[value="${correctOption.id}"]`).check();
  await medicineForm.locator('button[type="submit"]').click();
  await adminPage.waitForTimeout(500);

  const updatedResult = await prisma.result.findUniqueOrThrow({
    where: { questionId: medicine.id },
  });
  log(
    "6.4: the corrected answer (not the original proposal) is what got approved",
    updatedResult.correctAnswerOptionId === correctOption.id &&
      updatedResult.status === "APPROVED" &&
      updatedResult.approvedAt !== null
  );

  // --- Player: reload and confirm the corrected result is now visible ---
  await playerPage.reload();
  const correctedAnswerText = playerPage.locator("text=Correct answer: 3 laureates");
  log(
    "6.4/4.3: the player-facing page now shows the corrected result, not the original wrong proposal",
    (await correctedAnswerText.count()) === 1
  );
  const staleWrongAnswerText = playerPage.locator("text=Correct answer: 1 (solo)");
  log(
    "the original wrong proposal never reaches the player-facing page",
    (await staleWrongAnswerText.count()) === 0
  );

  // --- A non-admin cannot reach the grading form ---
  const nonAdminAccess = await playerPage.goto(`${BASE}/admin/results`);
  const bodyText = await playerPage.textContent("body");
  log(
    "a non-admin logged-in user is denied the admin page",
    !!nonAdminAccess?.ok() && /don.t have access/i.test(bodyText ?? "")
  );

  await browser.close();
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
