import { describe, expect, it } from "vitest";
import { checkRateLimit, RateLimitError } from "./rateLimit";

describe("checkRateLimit", () => {
  it("allows up to the limit within a window", () => {
    const store = new Map();
    for (let i = 0; i < 5; i++) {
      expect(() =>
        checkRateLimit("login:1.2.3.4", 5, 60_000, 1000, store)
      ).not.toThrow();
    }
  });

  it("throws once the limit is exceeded within the same window", () => {
    const store = new Map();
    for (let i = 0; i < 5; i++) {
      checkRateLimit("login:1.2.3.4", 5, 60_000, 1000, store);
    }
    expect(() =>
      checkRateLimit("login:1.2.3.4", 5, 60_000, 1000, store)
    ).toThrow(RateLimitError);
  });

  it("resets the count once the window has elapsed", () => {
    const store = new Map();
    for (let i = 0; i < 5; i++) {
      checkRateLimit("login:1.2.3.4", 5, 60_000, 1000, store);
    }
    expect(() =>
      checkRateLimit("login:1.2.3.4", 5, 60_000, 1000 + 60_000, store)
    ).not.toThrow();
  });

  it("tracks separate keys independently", () => {
    const store = new Map();
    for (let i = 0; i < 5; i++) {
      checkRateLimit("login:1.2.3.4", 5, 60_000, 1000, store);
    }
    expect(() =>
      checkRateLimit("login:5.6.7.8", 5, 60_000, 1000, store)
    ).not.toThrow();
  });
});
