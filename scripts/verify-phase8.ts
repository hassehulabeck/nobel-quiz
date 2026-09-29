import "dotenv/config";
import { chromium } from "playwright";
import { prisma } from "../src/lib/prisma.ts";
import { latestVerificationToken } from "./testHelpers.ts";

// TASKS.md 8.1's verify condition: "notice is shown on the signup page
// before account creation, and linked from the logged-in page footer."
// TASKS.md 8.2's verify condition: "deleting a test account leaves zero
// rows referencing that user (User, Session, Submission, score rows all
// gone via cascade or explicit delete), and the leaderboard/top-ten
// recomputes correctly for remaining users with no orphaned rows or
// broken foreign keys."

const BASE = "http://localhost:3000";

function log(step: string, ok: boolean, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"} - ${step}${extra ? ": " + extra : ""}`);
  if (!ok) process.exitCode = 1;
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const email = `delivered+phase8-${Date.now()}@resend.dev`;
  const password = "correct-horse-battery-staple";

  // --- 8.1: notice shown on the signup page, before account creation ---
  await page.goto(`${BASE}/signup`);
  const preSignupNotice = await page.textContent("main");
  log(
    "signup page shows what's stored / why / retention before account creation",
    /hashed/i.test(preSignupNotice ?? "") &&
      /quiz answers/i.test(preSignupNotice ?? "") &&
      /kept for as long as your account exists/i.test(preSignupNotice ?? ""),
    preSignupNotice?.slice(0, 50)
  );
  log(
    "signup page links to the full privacy notice",
    (await page.locator('a[href="/privacy"]').count()) >= 1
  );

  // --- 8.1: /privacy while logged out has no delete form, prompts login ---
  await page.goto(`${BASE}/privacy`);
  log(
    "logged-out /privacy has no delete-account form",
    (await page.locator('input[name="confirmDelete"]').count()) === 0
  );
  log(
    "logged-out /privacy explains what's stored/why/retention/deletion",
    /what we store/i.test((await page.textContent("main")) ?? "")
  );

  // --- signup, verify, login ---
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

  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`);

  const user = await prisma.user.findUniqueOrThrow({ where: { email } });

  // --- submit an answer, so we have a real Submission row to check cascades on ---
  const openQuestionForm = page.locator("form", { has: page.locator('input[name="answerOptionId"]') }).first();
  await openQuestionForm.locator('input[type="radio"]').first().check();
  await openQuestionForm.locator('button[type="submit"]').click();
  await page.waitForTimeout(500);
  const submissionsBeforeDelete = await prisma.submission.count({ where: { userId: user.id } });
  log("test user has at least one submission before deletion", submissionsBeforeDelete >= 1);

  // --- 8.1: logged-in home page footer links to /privacy ---
  await page.goto(`${BASE}/`);
  const footerLink = page.locator("footer a[href='/privacy']");
  log("logged-in page footer links to /privacy", (await footerLink.count()) === 1);
  await footerLink.click();
  await page.waitForURL(`${BASE}/privacy`);

  // --- 8.2: delete form is present now that we're logged in ---
  log(
    "logged-in /privacy shows the delete-account form",
    (await page.locator('input[name="confirmDelete"]').count()) === 1
  );

  // --- 8.2: wrong password is rejected, account survives ---
  await page.fill('input[name="password"]', "totally-wrong-password");
  await page.check('input[name="confirmDelete"]');
  await page.click('button:has-text("Delete my account")');
  await page.waitForSelector("p[role=alert]");
  const wrongPasswordError = await page.locator("p[role=alert]").textContent();
  log(
    "wrong password on delete is rejected with a specific message",
    /incorrect password/i.test(wrongPasswordError ?? ""),
    wrongPasswordError ?? ""
  );
  const survivedDelete = await prisma.user.findUnique({ where: { id: user.id } });
  log("account still exists after a rejected deletion attempt", survivedDelete !== null);

  // --- 8.2: correct password deletes for real ---
  await page.fill('input[name="password"]', password);
  await page.check('input[name="confirmDelete"]');
  await page.click('button:has-text("Delete my account")');
  await page.waitForURL(`${BASE}/login?deleted=1`);
  const deletedBanner = await page.locator("p[role=status]").textContent();
  log(
    "post-deletion redirect to /login shows a confirmation banner",
    /account and all its data have been deleted/i.test(deletedBanner ?? ""),
    deletedBanner ?? ""
  );

  // --- 8.2: zero rows reference the deleted user ---
  const userRow = await prisma.user.findUnique({ where: { id: user.id } });
  log("User row is gone", userRow === null);
  const sessionRows = await prisma.session.count({ where: { userId: user.id } });
  log("no Session rows reference the deleted user", sessionRows === 0);
  const submissionRows = await prisma.submission.count({ where: { userId: user.id } });
  log("no Submission rows reference the deleted user", submissionRows === 0);
  const tokenRows = await prisma.verificationToken.count({ where: { userId: user.id } });
  log("no VerificationToken rows reference the deleted user", tokenRows === 0);

  // --- old credentials no longer work ---
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForSelector("p[role=alert]");
  const oldLoginError = await page.locator("p[role=alert]").textContent();
  log(
    "old credentials are rejected after account deletion",
    /incorrect email or password/i.test(oldLoginError ?? ""),
    oldLoginError ?? ""
  );

  // --- leaderboard still computes cleanly with no orphaned/broken references ---
  const { computeLeaderboard } = await import("../src/lib/quiz/leaderboard.ts");
  let leaderboardThrew = false;
  let leaderboard: Awaited<ReturnType<typeof computeLeaderboard>> = [];
  try {
    leaderboard = await computeLeaderboard();
  } catch {
    leaderboardThrew = true;
  }
  log("leaderboard recomputes without throwing after the deletion", !leaderboardThrew);
  log(
    "deleted user no longer appears on the leaderboard",
    !leaderboard.some((entry) => entry.userId === user.id)
  );

  await browser.close();
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
