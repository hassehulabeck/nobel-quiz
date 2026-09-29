import "dotenv/config";
import { chromium } from "playwright";
import { prisma } from "../src/lib/prisma.ts";
import { latestVerificationToken } from "./testHelpers.ts";

// Regression check for the bug found on production 2026-09-29: the emailed
// `/verify?token=...` link was consumed by a plain GET, so a mail scanner or
// link previewer that merely fetched the URL burned the single-use token and
// the real user then saw "Already verified". Loading the page must now be
// side-effect free; only pressing the confirm button consumes the token.

const BASE = "http://localhost:3000";

function log(step: string, ok: boolean, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"} - ${step}${extra ? ": " + extra : ""}`);
  if (!ok) process.exitCode = 1;
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const email = `delivered+prefetch-${Date.now()}@resend.dev`;

  await page.goto(`${BASE}/signup`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', "correct-horse-battery-staple");
  await page.fill(
    'input[name="confirmPassword"]',
    "correct-horse-battery-staple"
  );
  await page.click('button[type="submit"]');
  await page.waitForURL(/check-email/);

  const token = await latestVerificationToken(email);
  const url = `${BASE}/verify?token=${token}`;

  // Simulate a mail scanner / link previewer: several bare GETs, no clicks.
  for (let i = 0; i < 3; i++) await fetch(url);
  const afterScans = await prisma.verificationToken.findUniqueOrThrow({
    where: { token },
  });
  const userAfterScans = await prisma.user.findUniqueOrThrow({
    where: { email },
  });
  log("bare GETs leave the token unused", afterScans.usedAt === null);
  log(
    "bare GETs leave the account unverified",
    userAfterScans.emailVerified === false
  );

  await page.goto(url);
  log(
    "real visit after the scans still offers the confirm button",
    (await page.locator('button:has-text("Confirm my email")').count()) === 1
  );

  await page.click('button:has-text("Confirm my email")');
  await page.waitForURL(/\/verify\?result=success/);
  log(
    "pressing confirm shows success",
    (await page.textContent("main"))?.includes("Email verified") ?? false
  );

  const used = await prisma.verificationToken.findUniqueOrThrow({
    where: { token },
  });
  const verified = await prisma.user.findUniqueOrThrow({ where: { email } });
  log("token is consumed after confirming", used.usedAt !== null);
  log("account is verified after confirming", verified.emailVerified === true);

  await page.goto(url);
  log(
    "reusing the link afterwards reports already-used",
    (await page.textContent("main"))?.includes("Already verified") ?? false
  );

  await prisma.user.delete({ where: { email } });
  await browser.close();
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
