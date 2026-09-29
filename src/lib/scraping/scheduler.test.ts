import { describe, it, expect } from "vitest";
import { ResultStatus } from "@/generated/prisma/enums";
import {
  shouldAttempt,
  ATTEMPT_DELAY_AFTER_DEADLINE_MS,
  RETRY_INTERVAL_MS,
  MAX_ATTEMPTS,
  type SchedulableTarget,
} from "./scheduler";

const DEADLINE = new Date("2026-10-06T09:45:00Z");

function target(overrides: Partial<SchedulableTarget> = {}): SchedulableTarget {
  return {
    dueAt: DEADLINE,
    resultStatus: "NOT_STARTED",
    scrapeAttempts: 0,
    lastAttemptAt: null,
    ...overrides,
  };
}

describe("shouldAttempt", () => {
  it("does not fire 2 minutes after the deadline (TASKS.md 6.2's exact example)", () => {
    const now = new Date(DEADLINE.getTime() + 2 * 60 * 1000);
    expect(shouldAttempt(target(), now)).toBe(false);
  });

  it("fires once 6 minutes after the deadline (TASKS.md 6.2's exact example)", () => {
    const now = new Date(DEADLINE.getTime() + 6 * 60 * 1000);
    expect(shouldAttempt(target(), now)).toBe(true);
  });

  it("fires exactly at the delay boundary", () => {
    const now = new Date(DEADLINE.getTime() + ATTEMPT_DELAY_AFTER_DEADLINE_MS);
    expect(shouldAttempt(target(), now)).toBe(true);
  });

  it("does not re-fire before the retry interval has elapsed since the last attempt", () => {
    const lastAttemptAt = new Date(DEADLINE.getTime() + 6 * 60 * 1000);
    const now = new Date(lastAttemptAt.getTime() + RETRY_INTERVAL_MS / 2);
    expect(
      shouldAttempt(
        target({ resultStatus: ResultStatus.PENDING, scrapeAttempts: 1, lastAttemptAt }),
        now
      )
    ).toBe(false);
  });

  it("fires again once the retry interval has elapsed", () => {
    const lastAttemptAt = new Date(DEADLINE.getTime() + 6 * 60 * 1000);
    const now = new Date(lastAttemptAt.getTime() + RETRY_INTERVAL_MS);
    expect(
      shouldAttempt(
        target({ resultStatus: ResultStatus.PENDING, scrapeAttempts: 1, lastAttemptAt }),
        now
      )
    ).toBe(true);
  });

  it("stops retrying once the attempt cap is reached, even long after the deadline", () => {
    const now = new Date(DEADLINE.getTime() + 30 * 24 * 60 * 60 * 1000);
    expect(
      shouldAttempt(
        target({ resultStatus: ResultStatus.PENDING, scrapeAttempts: MAX_ATTEMPTS }),
        now
      )
    ).toBe(false);
  });

  it("never re-attempts once a result has been proposed (awaiting admin, not more scraping)", () => {
    const now = new Date(DEADLINE.getTime() + 60 * 60 * 1000);
    expect(
      shouldAttempt(target({ resultStatus: ResultStatus.PROPOSED }), now)
    ).toBe(false);
  });

  it("never re-attempts once a result has been approved", () => {
    const now = new Date(DEADLINE.getTime() + 60 * 60 * 1000);
    expect(
      shouldAttempt(target({ resultStatus: ResultStatus.APPROVED }), now)
    ).toBe(false);
  });
});
