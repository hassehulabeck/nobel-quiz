import "dotenv/config";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { prisma } from "../src/lib/prisma.ts";
import { latestVerificationToken } from "./testHelpers.ts";

// TASKS.md 7.2's verify condition: "complete a full signup -> login -> answer
// a question -> view leaderboard flow using only the keyboard (no mouse),
// and with a screen reader (VoiceOver) reading meaningful labels at every
// step." The VoiceOver half is inherently manual (no CLI automation exists
// for it), but everything VoiceOver actually depends on — labels, landmarks,
// roles, focus order, focus visibility — is exactly what axe-core's
// automated ruleset and a real no-mouse keyboard walkthrough both check. So:
// this script (a) drives the whole flow with the keyboard only, asserting
// focus lands where a sighted keyboard user (and a screen reader user
// tabbing through) would expect, and (b) runs an axe scan against every
// distinct page/state in the app. A manual VoiceOver pass supplements this
// but this is the rerunnable, regression-catching half.

const BASE = "http://localhost:3000";

let failures = 0;
function log(step: string, ok: boolean, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"} - ${step}${extra ? ": " + extra : ""}`);
  if (!ok) failures++;
}

async function activeElementInfo(page: import("playwright").Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return null;
    return {
      tag: el.tagName,
      type: (el as HTMLInputElement).type ?? null,
      name: (el as HTMLInputElement).name ?? null,
      text: el.textContent?.trim().slice(0, 40) ?? null,
      id: el.id || null,
    };
  });
}

async function runAxe(page: import("playwright").Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical"
  );
  log(
    `axe scan clean (serious/critical) — ${label}`,
    serious.length === 0,
    serious.length
      ? serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length} node(s))`).join("; ")
      : ""
  );
}

async function main() {
  // Own the Medicine question's state explicitly rather than assuming
  // whatever another verify script (e.g. setup-quiz-test-data.ts, which
  // pushes this same question's deadline into the past) left behind — this
  // script needs it open and ungraded for the keyboard-answer step.
  const medicineSetup = await prisma.question.findFirstOrThrow({
    where: { text: { contains: "share the Physiology or Medicine prize" } },
  });
  await prisma.question.update({
    where: { id: medicineSetup.id },
    data: { answerDeadline: new Date(Date.now() + 60 * 60 * 1000) },
  });
  await prisma.result.deleteMany({ where: { questionId: medicineSetup.id } });

  // Also own end-of-week state: another verify script (e.g. verify-phase4.ts)
  // may have left Economics' Result rows approved >24h in the past, which
  // flips isEndOfWeek() to true and replaces the whole quiz page — including
  // the Medicine question above — with the final-results view. This script
  // needs the ordinary open-questions view to test the quiz form.
  await prisma.result.updateMany({
    where: { question: { prize: { key: "ECONOMICS" } } },
    data: { approvedAt: null },
  });

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    // --- axe scans across the app's distinct states ---
    await page.goto(`${BASE}/`);
    await runAxe(page, "home (logged out)");
    await page.goto(`${BASE}/login`);
    await runAxe(page, "login");
    await page.goto(`${BASE}/signup`);
    await runAxe(page, "signup");
    await page.goto(`${BASE}/forgot-password`);
    await runAxe(page, "forgot-password");

    // --- Skip link actually moves focus to <main>, not just decorative ---
    await page.goto(`${BASE}/`);
    await page.keyboard.press("Tab");
    const firstFocus = await activeElementInfo(page);
    log(
      "first Tab on a page focuses the skip link",
      firstFocus?.text === "Skip to main content",
      JSON.stringify(firstFocus)
    );
    await page.keyboard.press("Enter");
    const afterSkip = await activeElementInfo(page);
    log(
      "activating the skip link moves focus to #main-content",
      afterSkip?.id === "main-content",
      JSON.stringify(afterSkip)
    );

    // --- Full keyboard-only flow: signup -> verify -> login -> answer -> leaderboard ---
    const email = `delivered+phase7-${Date.now()}@resend.dev`;
    const password = "correct-horse-battery-staple";

    await page.goto(`${BASE}/signup`);
    await page.keyboard.press("Tab"); // skip link
    await page.keyboard.press("Tab"); // inline "full privacy notice" link in the GDPR paragraph (8.1)
    let focused = await activeElementInfo(page);
    log(
      "Tab order reaches the inline privacy-notice link before the form",
      focused?.text === "full privacy notice",
      JSON.stringify(focused)
    );
    await page.keyboard.press("Tab"); // email
    focused = await activeElementInfo(page);
    log("Tab order reaches the email field next on signup", focused?.name === "email", JSON.stringify(focused));
    await page.keyboard.type(email);
    await page.keyboard.press("Tab"); // password
    focused = await activeElementInfo(page);
    log("Tab order reaches password next", focused?.name === "password", JSON.stringify(focused));
    await page.keyboard.type(password);
    await page.keyboard.press("Tab"); // confirm password
    focused = await activeElementInfo(page);
    log("Tab order reaches confirm-password next", focused?.name === "confirmPassword", JSON.stringify(focused));
    await page.keyboard.type(password);
    await page.keyboard.press("Tab"); // submit button
    focused = await activeElementInfo(page);
    log("Tab order reaches the submit button last", focused?.tag === "BUTTON", JSON.stringify(focused));
    await page.keyboard.press("Enter");
    await page.waitForURL(`${BASE}/signup/check-email`);
    log("keyboard-only signup reaches the check-email page", true);

    const verifyToken = await latestVerificationToken(email);
    await page.goto(`${BASE}/verify?token=${verifyToken}`);
    await runAxe(page, "verify success");

    await page.goto(`${BASE}/login`);
    await page.keyboard.press("Tab"); // skip link
    await page.keyboard.press("Tab"); // email
    await page.keyboard.type(email);
    await page.keyboard.press("Tab"); // password
    await page.keyboard.type(password);
    await page.keyboard.press("Tab"); // submit
    focused = await activeElementInfo(page);
    log("Tab order reaches the login submit button", focused?.tag === "BUTTON", JSON.stringify(focused));
    await page.keyboard.press("Enter");
    await page.waitForURL(`${BASE}/`);
    log("keyboard-only login reaches the quiz page", true);
    await runAxe(page, "quiz page (logged in, open questions)");

    // --- Answer a question using only the keyboard ---
    const medicineForm = page.locator("form", { hasText: "share the Physiology or Medicine prize" });
    await medicineForm.locator('input[type="radio"]').first().focus();
    focused = await activeElementInfo(page);
    log("first radio in the question's fieldset is keyboard-focusable", focused?.type === "radio", JSON.stringify(focused));
    await page.keyboard.press("ArrowDown"); // native radio-group behavior: moves to + selects the next option
    const checkedOption = await medicineForm.locator('input[type="radio"]:checked').getAttribute("value");
    log("arrow keys select a different option within the radio group", !!checkedOption);

    // Tab from the radio group to the submit button (skips over any option labels, which aren't focusable).
    let guard = 0;
    while (guard++ < 10) {
      await page.keyboard.press("Tab");
      focused = await activeElementInfo(page);
      if (focused?.tag === "BUTTON") break;
    }
    log("Tab from the radio group reaches the form's submit button", focused?.tag === "BUTTON", JSON.stringify(focused));
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);

    const submission = await prisma.submission.findFirst({
      where: { questionId: medicineSetup.id, answerOptionId: checkedOption ?? undefined },
      include: { user: true },
    });
    log(
      "keyboard-only answer submission actually persisted the arrow-selected option",
      submission?.user.email === email,
      JSON.stringify({ checkedOption, submissionOptionId: submission?.answerOptionId })
    );

    // --- Leaderboard is reachable and has real accessible structure ---
    const leaderboardCaption = page.locator("table caption");
    log("leaderboard table has an accessible caption", (await leaderboardCaption.count()) >= 1);
    const columnHeaders = page.locator("table thead th[scope=col]");
    log("leaderboard table uses scope=col column headers", (await columnHeaders.count()) >= 3);
  } finally {
    await browser.close();
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed.`);
    process.exitCode = 1;
  } else {
    console.log("\nAll phase 7.2 checks passed.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
