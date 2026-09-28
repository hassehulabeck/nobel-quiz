/**
 * points = 1 / probability, where probability is the historical frequency
 * (historicalCount / historicalTotal) an answer option has actually occurred
 * over 2006-2025. See instructions.md's worked example: 1 laureate occurred
 * 4/20 times -> 1 / (4/20) = 5 points.
 */
export function computePoints(
  historicalCount: number,
  historicalTotal: number
): number {
  if (!Number.isInteger(historicalTotal) || historicalTotal <= 0) {
    throw new Error(
      `historicalTotal must be a positive integer, got ${historicalTotal}`
    );
  }
  if (!Number.isInteger(historicalCount) || historicalCount <= 0) {
    throw new Error(
      `historicalCount must be a positive integer (an answer option that never occurred historically should not be offered as a choice), got ${historicalCount}`
    );
  }
  if (historicalCount > historicalTotal) {
    throw new Error(
      `historicalCount (${historicalCount}) cannot exceed historicalTotal (${historicalTotal})`
    );
  }

  return historicalTotal / historicalCount;
}

/** Rounds to 3 decimal places for storage in the AnswerOption.points Decimal(6,3) column. */
export function roundPoints(points: number): number {
  return Math.round(points * 1000) / 1000;
}

export const NO_ANSWER_MATCHED_MESSAGE =
  "No answer was correct, every user gets 1 point";
export const NO_ANSWER_MATCHED_POINTS = 1;
