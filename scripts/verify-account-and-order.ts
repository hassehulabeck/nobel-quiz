import "dotenv/config";
import { chromium } from "playwright";
import { prisma } from "../src/lib/prisma.ts";
import { LAUREATES } from "../src/lib/auth/laureateNames.ts";
import { latestVerificationToken } from "./testHelpers.ts";

// Covers the 2026-09-29 additions: (1) default display names are former
// laureates with their blurb shown, and users can rename themselves (custom
// name, taken-name and laureate-name rejection, random re-roll); (2) the quiz
// page lists questions by announcement day, with a heavier divider before the
// whole-week questions. Needs `RESEND_API_KEY= npm run dev` on :3000.

const BASE = "http://localhost:3000";
const PASSWORD = "correct-horse-battery-staple";

function log(step: string, ok: boolean, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"} - ${step}${extra ? ": " + extra : ""}`);
  if (!ok) process.exitCode = 1;
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const email = `delivered+account-${Date.now()}@resend.dev`;
  const otherEmail = `delivered+other-${Date.now()}@resend.dev`;

  // A second player whose name the first will try to take (differing in case).
  await prisma.user.create({
    data: {
      email: otherEmail,
      passwordHash: "x",
      displayName: "Taken Name Test",
      emailVerified: true,
    },
  });

  try {
    await page.goto(`${BASE}/signup`);
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', PASSWORD);
    await page.fill('input[name="confirmPassword"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/check-email/);
    const token = await latestVerificationToken(email);
    await page.goto(`${BASE}/verify?token=${token}`);
    await page.click('button:has-text("Confirm my email")');
    await page.waitForURL(/\/verify\?result=/);
    await page.goto(`${BASE}/login`);
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE}/`);

    // --- default name is a laureate, blurb shown ---
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const laureate = LAUREATES.find((l) => l.name === user.displayName);
    log(
      "new account gets a former laureate as display name",
      !!laureate,
      user.displayName
    );
    const header = (await page.textContent("header")) ?? "";
    log(
      "welcome header shows the name and its laureate blurb",
      !!laureate &&
        header.includes(user.displayName) &&
        header.includes(laureate.info)
    );

    // --- question ordering and dividers ---
    const headings = await page.locator("main h2").allTextContents();
    const days = headings.filter((h) =>
      /^(Mon|Tues|Wednes|Thurs|Fri)day /.test(h)
    );
    const expected = [
      "Monday 5 October · Physiology or Medicine",
      "Tuesday 6 October · Physics",
      "Wednesday 7 October · Chemistry",
      "Thursday 8 October · Literature",
      "Friday 9 October · Peace",
      "Monday 12 October · Economic Sciences",
    ];
    log(
      "day headings are chronological, Medicine first",
      JSON.stringify(days.map((d) => d.replace(/\s+/g, " ").trim())) ===
        JSON.stringify(expected),
      days.join(" | ")
    );
    log(
      "whole-week questions come after every day",
      headings.lastIndexOf("Whole-week questions") >
        headings.indexOf(days[days.length - 1]) &&
        headings.includes("Whole-week questions")
    );
    const widths = await page
      .locator("main section")
      .evaluateAll((els) => els.map((e) => getComputedStyle(e).borderTopWidth));
    const thin = widths.filter((w) => w === "1px").length;
    const heavy = widths.filter((w) => w === "4px").length;
    log(
      "thin divider between days (5 of 6), one heavy divider before whole-week",
      thin === 5 && heavy === 1,
      widths.join(",")
    );

    // --- renaming ---
    await page.goto(`${BASE}/account`);
    const nameInput = page.locator('input[name="displayName"]');
    const submitCustom = page.locator('button[value="custom"]');

    await nameInput.fill("  Ada   Lovelace ");
    await submitCustom.click();
    await page.waitForSelector('main p[role="status"]');
    log(
      "custom name saved (whitespace tidied)",
      (await prisma.user.findUniqueOrThrow({ where: { email } }))
        .displayName === "Ada Lovelace"
    );

    await nameInput.fill("taken name TEST");
    await submitCustom.click();
    await page.waitForSelector('main p[role="alert"]');
    log(
      "name taken by someone else is rejected, case-insensitively",
      (await page.textContent('main p[role="alert"]'))?.includes(
        "already taken"
      ) ?? false
    );

    await nameInput.fill("Albert Einstein");
    await submitCustom.click();
    await page.waitForFunction(() =>
      document
        .querySelector('main p[role="alert"]')
        ?.textContent?.includes("laureate")
    );
    log("laureate names can't be typed in as custom names", true);

    await nameInput.fill("<script>");
    await submitCustom.click();
    await page.waitForFunction(() =>
      document
        .querySelector('main p[role="alert"]')
        ?.textContent?.includes("letters, numbers")
    );
    log("odd characters are rejected", true);

    await page.click('button[value="random"]');
    await page.waitForSelector('main p[role="status"]');
    const rerolled = (await prisma.user.findUniqueOrThrow({ where: { email } }))
      .displayName;
    log(
      "'random laureate' gives a laureate name",
      LAUREATES.some((l) => l.name === rerolled),
      rerolled
    );

    await page.goto(`${BASE}/`);
    log(
      "new name shows on the main page",
      ((await page.textContent("header")) ?? "").includes(rerolled)
    );
  } finally {
    await prisma.user.deleteMany({
      where: { email: { in: [email, otherEmail] } },
    });
    await browser.close();
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
