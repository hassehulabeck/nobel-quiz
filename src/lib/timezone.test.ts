import { describe, expect, it } from "vitest";
import { isSameStockholmDay } from "./timezone";

describe("isSameStockholmDay", () => {
  it("treats two timestamps on the same UTC calendar day as the same day", () => {
    expect(
      isSameStockholmDay(
        new Date("2026-10-06T08:00:00Z"),
        new Date("2026-10-06T20:00:00Z")
      )
    ).toBe(true);
  });

  it("treats timestamps on different calendar days as different", () => {
    // 21:59 UTC is 23:59 CEST on Oct 6; 22:01 UTC is 00:01 CEST on Oct 7.
    expect(
      isSameStockholmDay(
        new Date("2026-10-06T21:59:00Z"),
        new Date("2026-10-06T22:01:00Z")
      )
    ).toBe(false);
  });

  it("accounts for the Stockholm UTC+2 offset in October (CEST), not raw UTC date", () => {
    // 22:30 UTC on Oct 6 is 00:30 CEST on Oct 7 in Stockholm.
    expect(
      isSameStockholmDay(
        new Date("2026-10-06T22:30:00Z"),
        new Date("2026-10-07T10:00:00Z")
      )
    ).toBe(true);
    expect(
      isSameStockholmDay(
        new Date("2026-10-06T22:30:00Z"),
        new Date("2026-10-06T10:00:00Z")
      )
    ).toBe(false);
  });
});
