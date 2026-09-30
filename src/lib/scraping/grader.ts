import type { PrizeKey } from "@/generated/prisma/enums";
import type { ScrapedLaureate, ScrapedPrizeData } from "./nobelApi";

/**
 * Auto-grading (TASKS.md 6.3). Each `gradingKey` computes one canonical
 * string value from scraped data, which is then matched against each
 * question's `AnswerOption.matchValue`. `gradingKey === null` (Literature
 * genre, both citizenship questions) is never handled here — those always
 * go to admin-only manual grading. See METHODS.md's Phase 6 entry.
 */

export type GradingProposal = {
  /** The computed signal, comparable to AnswerOption.matchValue. Null if the signal itself couldn't be computed (e.g. missing data). */
  computedValue: string | null;
  confidence: "high" | "low";
  rawScrapedData: unknown;
};

function normalizeMotivation(motivation: string | null): string {
  return (motivation ?? "").trim().toLowerCase();
}

const PHYSICS_DISCOVERY_OPENINGS = [
  /^for the discovery (of|that)/,
  /^for their discovery of/,
  /^for the theoretical discovery of/,
];

const CHEMISTRY_DEVELOPMENT_OPENINGS = [
  /^for the development of/,
  /^for developing/,
];

function representativeMotivation(data: ScrapedPrizeData): string {
  return normalizeMotivation(
    data.topMotivation ?? data.laureates[0]?.motivation ?? null
  );
}

function computeAge(
  birthDate: string | null,
  dateAwarded: string | null
): number | null {
  if (!birthDate || !dateAwarded) return null;
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [ay, am, ad] = dateAwarded.split("-").map(Number);
  if (!by || !ay) return null;

  let age = ay - by;
  if (bm && bd && am && ad && (am < bm || (am === bm && ad < bd))) {
    age -= 1;
  }
  return age;
}

function anyMitAffiliation(laureates: ScrapedLaureate[]): boolean {
  return laureates.some((l) =>
    (l.affiliationName ?? "")
      .toLowerCase()
      .match(/\bmit\b|massachusetts institute of technology/)
  );
}

// Word-boundary patterns so "University of British Columbia" or "Penn State"
// don't count. The Institute for Advanced Study is independent of Princeton.
const IVY_LEAGUE_PATTERNS = [
  /\bbrown university\b/,
  /\bcolumbia university\b/,
  /\bcornell\b/,
  /\bdartmouth\b/,
  /\bharvard\b/,
  /\bprinceton university\b/,
  /\buniversity of pennsylvania\b/,
  /\byale\b/,
];

function countIvyLeagueAffiliations(laureates: ScrapedLaureate[]): number {
  return laureates.filter((l) => {
    const name = (l.affiliationName ?? "").toLowerCase();
    return IVY_LEAGUE_PATTERNS.some((re) => re.test(name));
  }).length;
}

function bucketCountAtLeast3(count: number): string {
  if (count >= 3) return "3+";
  return String(count);
}

/** Grades a PRIZE_SPECIFIC question against that prize's own scraped data. */
export function gradePrizeSpecificQuestion(
  gradingKey: string,
  data: ScrapedPrizeData
): GradingProposal {
  const rawScrapedData = data;

  switch (gradingKey) {
    case "LAUREATE_COUNT":
      return {
        computedValue: String(data.laureateCount),
        confidence: "high",
        rawScrapedData,
      };

    case "PHRASE_DISCOVERY_OF": {
      const motivation = representativeMotivation(data);
      const matched = PHYSICS_DISCOVERY_OPENINGS.some((re) =>
        re.test(motivation)
      );
      return {
        computedValue: matched ? "yes" : "no",
        confidence: "high",
        rawScrapedData,
      };
    }

    case "PHRASE_DEVELOPMENT_OF": {
      const motivation = representativeMotivation(data);
      const matched = CHEMISTRY_DEVELOPMENT_OPENINGS.some((re) =>
        re.test(motivation)
      );
      return {
        computedValue: matched ? "yes" : "no",
        confidence: "high",
        rawScrapedData,
      };
    }

    case "PHRASE_CONTAINS_DISCOVER": {
      const motivation = representativeMotivation(data);
      return {
        computedValue: motivation.includes("discover") ? "yes" : "no",
        confidence: "high",
        rawScrapedData,
      };
    }

    case "AFFILIATION_MIT":
      return {
        computedValue: anyMitAffiliation(data.laureates) ? "yes" : "no",
        confidence: "high",
        rawScrapedData,
      };

    case "PEACE_TYPE_SPLIT": {
      const hasIndividual = data.laureates.some((l) => !l.isOrganisation);
      const hasOrganisation = data.laureates.some((l) => l.isOrganisation);
      let computedValue: string;
      if (hasIndividual && hasOrganisation) computedValue = "mixed";
      else if (hasOrganisation) computedValue = "organisation";
      else computedValue = "individual";
      return { computedValue, confidence: "high", rawScrapedData };
    }

    default:
      return { computedValue: null, confidence: "low", rawScrapedData };
  }
}

export type ResolvedGrading = {
  correctAnswerOptionId: string | null;
  /** True when the computed signal matched none of the question's options — triggers the 2.6 fallback. */
  noneMatched: boolean;
};

/**
 * Matches a proposal's computed value against a question's options.
 * `computedValue === null` means the signal itself couldn't be computed
 * (e.g. a whole-week question before all six prizes are in) — distinct from
 * "computed, but matched no option," which is the 2.6 fallback.
 */
export function resolveProposal(
  proposal: GradingProposal,
  options: { id: string; matchValue: string | null }[]
): ResolvedGrading | null {
  if (proposal.computedValue === null) return null;

  const match = options.find((o) => o.matchValue === proposal.computedValue);
  if (match) return { correctAnswerOptionId: match.id, noneMatched: false };
  return { correctAnswerOptionId: null, noneMatched: true };
}

/** Grades a WHOLE_WEEK question against all six prizes' scraped data for the year. */
export function gradeWholeWeekQuestion(
  gradingKey: string,
  dataByPrize: Partial<Record<PrizeKey, ScrapedPrizeData>>
): GradingProposal {
  const allPrizes = Object.values(dataByPrize).filter(
    (d): d is ScrapedPrizeData => !!d
  );
  const allLaureates = allPrizes.flatMap((d) => d.laureates);
  const rawScrapedData = dataByPrize;

  // Every prize must have been scraped before a whole-week signal is trustworthy.
  if (allPrizes.length < 6) {
    return { computedValue: null, confidence: "low", rawScrapedData };
  }

  switch (gradingKey) {
    case "WHOLE_WEEK_FEMALE_COUNT": {
      const femaleCount = allLaureates.filter(
        (l) => l.gender === "female"
      ).length;
      return {
        computedValue: bucketCountAtLeast3(femaleCount),
        confidence: "high",
        rawScrapedData,
      };
    }

    case "WHOLE_WEEK_AVG_AGE_GT72": {
      const ages = allLaureates
        .filter((l) => !l.isOrganisation)
        .map((l) => computeAge(l.birthDate, l.dateAwarded))
        .filter((age): age is number => age !== null);
      if (ages.length === 0) {
        return { computedValue: null, confidence: "low", rawScrapedData };
      }
      const avg = ages.reduce((sum, a) => sum + a, 0) / ages.length;
      return {
        computedValue: avg > 72 ? "yes" : "no",
        confidence: "high",
        rawScrapedData,
      };
    }

    case "WHOLE_WEEK_AFRICA_RESIDENT": {
      const anyAfrica = allLaureates.some(
        (l) =>
          l.affiliationContinent === "Africa" ||
          (l.affiliationName === null && l.birthContinent === "Africa")
      );
      return {
        computedValue: anyAfrica ? "yes" : "no",
        // Low confidence: residence ≠ affiliation/birth country for Peace
        // laureates especially — see METHODS.md's Phase 6 entry.
        confidence: "low",
        rawScrapedData,
      };
    }

    case "WHOLE_WEEK_IVY_COUNT":
      return {
        computedValue: bucketCountAtLeast3(
          countIvyLeagueAffiliations(allLaureates)
        ),
        // Low confidence: the API lists only a laureate's first affiliation.
        confidence: "low",
        rawScrapedData,
      };

    default:
      return { computedValue: null, confidence: "low", rawScrapedData };
  }
}
