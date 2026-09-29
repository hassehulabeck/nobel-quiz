import { readFileSync } from "node:fs";

// TASKS.md 7.1's verify condition: "every text/background color pair used in
// the UI passes WCAG AA contrast (4.5:1 body text, 3:1 large text/UI
// components)." Reads the actual hex values out of globals.css (rather than
// a hand-copied list) so this can't silently drift from the real palette,
// and checks every pairing that's actually used somewhere in the app's
// components (grepped by hand against src/components + src/app).

const CSS_PATH = new URL("../src/app/globals.css", import.meta.url);
const css = readFileSync(CSS_PATH, "utf8");

function readVar(name: string): string {
  const rootBlockMatch = css.match(/:root\s*{([^}]*)}/s);
  if (!rootBlockMatch) throw new Error(":root block not found in globals.css");
  const re = new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`);
  const match = rootBlockMatch[1].match(re);
  if (!match) throw new Error(`Variable ${name} not found in :root block`);
  return match[1];
}

function srgbToLinear(c: number): number {
  c /= 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex: string): number {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

function contrastRatio(hexA: string, hexB: string): number {
  const lA = relativeLuminance(hexA);
  const lB = relativeLuminance(hexB);
  const lighter = Math.max(lA, lB);
  const darker = Math.min(lA, lB);
  return (lighter + 0.05) / (darker + 0.05);
}

let failures = 0;

function checkText(label: string, fgVar: string, bgVar: string, minRatio: number) {
  const fg = readVar(fgVar);
  const bg = readVar(bgVar);
  const ratio = contrastRatio(fg, bg);
  const pass = ratio >= minRatio;
  console.log(
    `${pass ? "PASS" : "FAIL"} - ${label}: ${fgVar}(${fg}) on ${bgVar}(${bg}) = ${ratio.toFixed(2)}:1 (need >= ${minRatio}:1)`
  );
  if (!pass) failures++;
}

// Body text pairs (4.5:1) — every place regular-weight/body-size text sits
// on a background in the app.
checkText("page background text", "--color-foreground", "--color-background", 4.5);
checkText("card/surface text", "--color-foreground", "--color-surface", 4.5);
checkText("muted text on page background", "--color-muted-foreground", "--color-background", 4.5);
checkText("muted text on surface", "--color-muted-foreground", "--color-surface", 4.5);
checkText("primary button label", "--color-primary-foreground", "--color-primary", 4.5);
checkText("primary button label (hover)", "--color-primary-foreground", "--color-primary-hover", 4.5);
checkText("secondary/link color on background", "--color-secondary", "--color-background", 4.5);
checkText("link color on background", "--color-primary-hover", "--color-background", 4.5);
checkText("accent tint text on its tint bg", "--color-accent-tint-foreground", "--color-accent-tint", 4.5);
checkText("accent tint text on surface", "--color-accent-tint-foreground", "--color-surface", 4.5);
checkText("info tint text on its tint bg", "--color-info-tint-foreground", "--color-info-tint", 4.5);
checkText("warning tint text on its tint bg", "--color-warning-tint-foreground", "--color-warning-tint", 4.5);
checkText("destructive text on its tint bg", "--color-destructive", "--color-destructive-tint", 4.5);

// UI component / non-text boundaries (3:1) — borders and focus rings need
// to be visible against the backgrounds they sit on, not readable as text.
checkText("border vs page background", "--color-border", "--color-background", 3);
checkText("border vs surface", "--color-border", "--color-surface", 3);
checkText("focus ring vs page background", "--color-ring", "--color-background", 3);
checkText("focus ring vs surface", "--color-ring", "--color-surface", 3);

if (failures > 0) {
  console.error(`\n${failures} contrast check(s) failed.`);
  process.exitCode = 1;
} else {
  console.log("\nAll contrast checks passed.");
}
