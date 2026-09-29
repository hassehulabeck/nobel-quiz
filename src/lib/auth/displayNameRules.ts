import { isLaureateName } from "./laureateNames";

export const DISPLAY_NAME_MIN = 3;
export const DISPLAY_NAME_MAX = 24;

// Letters and digits (any script) to start, then also spaces, dots,
// apostrophes and hyphens. No emoji, markup or control characters.
const ALLOWED = /^[\p{L}\p{N}][\p{L}\p{N} .'-]*$/u;

export type DisplayNameCheck = { name: string } | { error: string };

/** Pure validation for a user-chosen display name (uniqueness is checked against the DB separately). */
export function checkCustomDisplayName(raw: string): DisplayNameCheck {
  const name = raw.trim().replace(/\s+/g, " ");
  if (name.length < DISPLAY_NAME_MIN || name.length > DISPLAY_NAME_MAX) {
    return {
      error: `Name must be ${DISPLAY_NAME_MIN}–${DISPLAY_NAME_MAX} characters`,
    };
  }
  if (!ALLOWED.test(name)) {
    return {
      error: "Use letters, numbers, spaces, dots, apostrophes and hyphens only",
    };
  }
  if (isLaureateName(name)) {
    return {
      error:
        "That's one of the laureate names we hand out — use “Give me a random laureate” for those, or pick your own",
    };
  }
  return { name };
}
