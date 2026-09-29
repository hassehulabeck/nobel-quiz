import "dotenv/config";
import { chromium } from "playwright";
import { prisma } from "../src/lib/prisma.ts";
import { latestVerificationToken } from "./testHelpers.ts";

// TASKS.md 7.3's verify condition: "manual check at 375px, 768px, and 1440px
// widths — no horizontal scroll, no overlapping/clipped content." Automated
// here as: (a) no horizontal scrollbar at any of the three widths on every
// distinct page/state, and (b) no two visible elements' bounding boxes
// overlap unexpectedly (a cheap but real proxy for "clipped/overlapping
// content" that a manual pass alone wouldn't guarantee stays true after
// future changes).

const BASE = "http://localhost:3000";
const WIDTHS = [375, 768, 1440];

let failures = 0;
function log(step: string, ok: boolean, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"} - ${step}${extra ? ": " + extra : ""}`);
  if (!ok) failures++;
}

async function checkNoHorizontalScroll(page: import("playwright").Page, label: string, width: number) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  log(
    `no horizontal scroll — ${label} @ ${width}px`,
    scrollWidth <= clientWidth,
    `scrollWidth=${scrollWidth} clientWidth=${clientWidth}`
  );
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const email = `delivered+phase7-responsive-${Date.now()}@resend.dev`;
  const password = "correct-horse-battery-staple";

  await page.setViewportSize({ width: 1024, height: 900 });
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

  const pages: Array<{ label: string; path: string }> = [
    { label: "home (logged out)", path: "__logged_out_home__" },
    { label: "login", path: "/login" },
    { label: "signup", path: "/signup" },
    { label: "quiz page (logged in)", path: "/" },
  ];

  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });

    for (const { label, path } of pages) {
      if (path === "__logged_out_home__") continue; // handled separately, needs a logged-out context
      await page.goto(`${BASE}${path}`);
      await checkNoHorizontalScroll(page, label, width);
    }
  }

  // Logged-out home, in a fresh context so it's not affected by the logged-in session.
  const loggedOutContext = await browser.newContext();
  const loggedOutPage = await loggedOutContext.newPage();
  for (const width of WIDTHS) {
    await loggedOutPage.setViewportSize({ width, height: 900 });
    await loggedOutPage.goto(`${BASE}/`);
    await checkNoHorizontalScroll(loggedOutPage, "home (logged out)", width);
  }
  await loggedOutContext.close();

  // Overlap check at the narrowest width, on the page with the most content
  // (logged-in quiz page: header, leaderboard table, question cards).
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto(`${BASE}/`);
  const overlaps = await page.evaluate(() => {
    const candidates = Array.from(
      document.querySelectorAll("main :is(h1, h2, table, form, button, a)")
    ) as HTMLElement[];
    const rects = candidates
      .map((el) => ({ el, rect: el.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width > 0 && rect.height > 0);
    const found: string[] = [];
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i].rect;
        const b = rects[j].rect;
        // Skip ancestor/descendant pairs (containment is expected, not overlap).
        if (rects[i].el.contains(rects[j].el) || rects[j].el.contains(rects[i].el)) continue;
        const overlapsX = a.left < b.right && b.left < a.right;
        const overlapsY = a.top < b.bottom && b.top < a.bottom;
        if (overlapsX && overlapsY) {
          found.push(`${rects[i].el.tagName}("${rects[i].el.textContent?.trim().slice(0, 20)}") overlaps ${rects[j].el.tagName}("${rects[j].el.textContent?.trim().slice(0, 20)}")`);
        }
      }
    }
    return found;
  });
  log("no unexpected overlapping elements on the quiz page @ 375px", overlaps.length === 0, overlaps.join("; "));

  await browser.close();

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed.`);
    process.exitCode = 1;
  } else {
    console.log("\nAll phase 7.3 responsive checks passed.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
