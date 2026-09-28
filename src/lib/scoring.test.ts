import { describe, expect, it } from "vitest";
import { computePoints, roundPoints } from "./scoring";

describe("computePoints", () => {
  it("matches the worked example from instructions.md (4/20 -> 5 points)", () => {
    expect(computePoints(4, 20)).toBe(5);
  });

  it("matches the other two buckets from the same worked example", () => {
    expect(computePoints(6, 20)).toBeCloseTo(3.333, 3);
    expect(computePoints(10, 20)).toBe(2);
  });

  it("rejects a historicalCount of 0 rather than dividing by zero", () => {
    expect(() => computePoints(0, 20)).toThrow(/positive integer/);
  });

  it("rejects a non-positive historicalTotal", () => {
    expect(() => computePoints(4, 0)).toThrow(/positive integer/);
  });

  it("rejects historicalCount greater than historicalTotal", () => {
    expect(() => computePoints(21, 20)).toThrow(/cannot exceed/);
  });
});

describe("roundPoints", () => {
  it("rounds to 3 decimal places", () => {
    expect(roundPoints(20 / 6)).toBe(3.333);
  });
});
