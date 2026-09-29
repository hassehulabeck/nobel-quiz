import { describe, expect, it } from "vitest";
import {
  computePoints,
  computeSubmissionPoints,
  NO_ANSWER_MATCHED_MESSAGE,
  NO_ANSWER_MATCHED_POINTS,
  roundPoints,
} from "./scoring";

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

describe("computeSubmissionPoints", () => {
  it("returns null when the result isn't approved yet", () => {
    expect(
      computeSubmissionPoints(
        { approvedAt: null, noneMatched: false, correctAnswerOptionId: "a" },
        { answerOptionId: "a" },
        5
      )
    ).toBeNull();
  });

  it("returns 0 for a user who never submitted an answer", () => {
    expect(
      computeSubmissionPoints(
        {
          approvedAt: new Date(),
          noneMatched: false,
          correctAnswerOptionId: "a",
        },
        null,
        5
      )
    ).toBe(0);
  });

  it("returns the option's points for a correct pick", () => {
    expect(
      computeSubmissionPoints(
        {
          approvedAt: new Date(),
          noneMatched: false,
          correctAnswerOptionId: "a",
        },
        { answerOptionId: "a" },
        5
      )
    ).toBe(5);
  });

  it("returns 0 for an incorrect pick", () => {
    expect(
      computeSubmissionPoints(
        {
          approvedAt: new Date(),
          noneMatched: false,
          correctAnswerOptionId: "a",
        },
        { answerOptionId: "b" },
        5
      )
    ).toBe(0);
  });

  it("awards the flat fallback to anyone who submitted when noneMatched is true", () => {
    expect(
      computeSubmissionPoints(
        {
          approvedAt: new Date(),
          noneMatched: true,
          correctAnswerOptionId: null,
        },
        { answerOptionId: "b" },
        5
      )
    ).toBe(NO_ANSWER_MATCHED_POINTS);
  });

  it("still returns 0 for a non-submitter even when noneMatched is true", () => {
    expect(
      computeSubmissionPoints(
        {
          approvedAt: new Date(),
          noneMatched: true,
          correctAnswerOptionId: null,
        },
        null,
        5
      )
    ).toBe(0);
  });

  // TASKS.md 2.6: the fallback must show this exact copy, not just award 1 point.
  it("uses the literal copy required by the 2.6 fallback rule", () => {
    expect(NO_ANSWER_MATCHED_MESSAGE).toBe(
      "No answer was correct, every user gets 1 point"
    );
  });
});
