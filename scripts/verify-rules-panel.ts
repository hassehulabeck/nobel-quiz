import "dotenv/config";
import { chromium } from "playwright";
import { prisma } from "../src/lib/prisma.ts";
import { computePoints } from "../src/lib/scoring.ts";
import { latestVerificationToken } from "./testHelpers.ts";

// The collapsible "How the game works" panel at the top of the quiz page:
// present above the leaderboard, open on first visit, hideable with the mouse
// or keyboard, and the choice survives reloads (cookie, read on the server, so
// no flash). Also checks that the worked example in the text is the real
// formula's output. Needs `RESEND_API_KEY= npm run dev` on :3000.

const BASE = "http://localhost:3000";
const PASSWORD = "correct-horse-battery-staple";

function log(step: string, ok: boolean, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"} - ${step}${extra ? ": " + extra : ""}`);
  if (!ok) process.exitCode = 1;
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const email = `delivered+rules-${Date.now()}@resend.dev`;

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

    const details = page.locator("main details");
    const isOpen = () =>
      details.evaluate((el) => (el as HTMLDetailsElement).open);
    const bodyVisible = () =>
      page
        .locator("main details >> text=Points come from the odds")
        .isVisible();

    log("rules panel is on the page", (await details.count()) === 1);
    const order = await page
      .locator("main > *")
      .evaluateAll((els) =>
        els.map((e) =>
          e.tagName === "DETAILS"
            ? "rules"
            : e.textContent?.includes("Leaderboard")
              ? "leaderboard"
              : e.tagName
        )
      );
    log(
      "it sits above the leaderboard",
      order.indexOf("rules") !== -1 &&
        order.indexOf("rules") < order.indexOf("leaderboard"),
      order.join(",")
    );
    log(
      "open by default on the first visit",
      (await isOpen()) && (await bodyVisible())
    );

    const text = (await details.textContent()) ?? "";
    log(
      "worked example matches the real formula",
      text.includes(`= ${computePoints(4, 20)} points`),
      `computePoints(4, 20) = ${computePoints(4, 20)}`
    );
    log(
      "mentions the 20-year odds base and the 1-point fallback",
      text.includes("2006–2025") && text.includes("everyone gets 1 point")
    );

    await page.click("main details summary");
    // The cookie is written from the (async) toggle event; wait for it so the
    // reload below can't outrun it.
    await page.waitForFunction(() =>
      document.cookie.includes("rules-hidden=1")
    );
    log(
      "clicking the heading hides it",
      !(await isOpen()) && !(await bodyVisible())
    );

    await page.reload();
    log("stays hidden after a reload", !(await isOpen()));

    // Keyboard: focus the summary, Enter re-opens it.
    await page.locator("main details summary").focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(() =>
      document.cookie.includes("rules-hidden=0")
    );
    log(
      "Enter on the heading shows it again",
      (await isOpen()) && (await bodyVisible())
    );

    await page.reload();
    log("stays open after a reload", await isOpen());
  } finally {
    await prisma.user.deleteMany({ where: { email } });
    await browser.close();
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
