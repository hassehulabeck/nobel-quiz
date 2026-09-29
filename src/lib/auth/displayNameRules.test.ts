import { describe, expect, it } from "vitest";
import { LAUREATES, laureateInfoFor } from "./laureateNames";
import { checkCustomDisplayName } from "./displayNameRules";

describe("laureate names", () => {
  it("has unique names, each within the display-name length limit", () => {
    const lower = LAUREATES.map((l) => l.name.toLowerCase());
    expect(new Set(lower).size).toBe(lower.length);
    for (const l of LAUREATES) expect(l.name.length).toBeLessThanOrEqual(30);
  });

  it("looks up info case-insensitively and ignores other names", () => {
    expect(laureateInfoFor("marie curie")).toBe("Physics 1903, Chemistry 1911");
    expect(laureateInfoFor("Golden Zinnia")).toBeUndefined();
  });
});

describe("checkCustomDisplayName", () => {
  it("trims and collapses whitespace", () => {
    expect(checkCustomDisplayName("  Ada   Lovelace ")).toEqual({
      name: "Ada Lovelace",
    });
  });
  it("rejects too short, too long and odd characters", () => {
    expect(checkCustomDisplayName("ab")).toHaveProperty("error");
    expect(checkCustomDisplayName("x".repeat(25))).toHaveProperty("error");
    expect(checkCustomDisplayName("<b>hi</b>")).toHaveProperty("error");
    expect(checkCustomDisplayName("smile 😀 face")).toHaveProperty("error");
  });
  it("accepts non-English letters", () => {
    expect(checkCustomDisplayName("Åsa Öberg")).toEqual({ name: "Åsa Öberg" });
  });
  it("blocks laureate names so nobody impersonates one", () => {
    expect(checkCustomDisplayName("albert einstein")).toHaveProperty("error");
  });
});
