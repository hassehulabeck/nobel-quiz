import { describe, it, expect } from "vitest";
import {
  gradePrizeSpecificQuestion,
  gradeWholeWeekQuestion,
  resolveProposal,
} from "./grader";
import type { ScrapedLaureate, ScrapedPrizeData } from "./nobelApi";
import {
  PRIZE_QUESTIONS,
  WHOLE_WEEK_QUESTIONS,
} from "../../../prisma/seedData";

/**
 * TASKS.md 6.3's verify condition: feed real 2025 outcomes (from
 * nobeldata.md) through the grader against the actual 2026-seeded
 * questions/options, and confirm the proposal matches what a human
 * reading nobeldata.md would pick. Fixtures below are 2025's real
 * laureates; ages are backed into birth years so computeAge reproduces
 * nobeldata.md's stated ages exactly (day/month fixed at Jan 1 vs. the
 * October award date, so no off-by-one adjustment applies).
 */

function laureate(
  name: string,
  overrides: Partial<ScrapedLaureate> = {}
): ScrapedLaureate {
  return {
    id: name,
    name,
    isOrganisation: false,
    gender: "male",
    birthDate: null,
    birthCountry: null,
    birthContinent: null,
    affiliationName: null,
    affiliationCountry: null,
    affiliationContinent: null,
    motivation: null,
    dateAwarded: "2025-10-06",
    ...overrides,
  };
}

function ageBirthDate(age: number): string {
  return `${2025 - age}-01-01`;
}

const physics2025: ScrapedPrizeData = {
  prizeKey: "PHYSICS",
  year: 2025,
  laureateCount: 3,
  fetchedAt: "2025-10-06T00:00:00Z",
  topMotivation: null,
  laureates: [
    laureate("John Clarke", {
      birthDate: ageBirthDate(83),
      dateAwarded: "2025-10-07",
      motivation:
        "for the discovery of macroscopic quantum mechanical tunnelling and energy quantisation in an electric circuit",
    }),
    laureate("Michel H. Devoret", {
      gender: "male",
      birthDate: ageBirthDate(72),
      dateAwarded: "2025-10-07",
      motivation:
        "for the discovery of macroscopic quantum mechanical tunnelling and energy quantisation in an electric circuit",
    }),
    laureate("John M. Martinis", {
      birthDate: ageBirthDate(67),
      dateAwarded: "2025-10-07",
      motivation:
        "for the discovery of macroscopic quantum mechanical tunnelling and energy quantisation in an electric circuit",
    }),
  ],
};

const chemistry2025: ScrapedPrizeData = {
  prizeKey: "CHEMISTRY",
  year: 2025,
  laureateCount: 3,
  fetchedAt: "2025-10-08T00:00:00Z",
  topMotivation: null,
  laureates: [
    laureate("Susumu Kitagawa", {
      birthDate: ageBirthDate(74),
      dateAwarded: "2025-10-08",
      motivation: "for the development of metal–organic frameworks",
    }),
    laureate("Richard Robson", {
      birthDate: ageBirthDate(88),
      dateAwarded: "2025-10-08",
      motivation: "for the development of metal–organic frameworks",
    }),
    laureate("Omar M. Yaghi", {
      birthDate: ageBirthDate(60),
      dateAwarded: "2025-10-08",
      motivation: "for the development of metal–organic frameworks",
    }),
  ],
};

const medicine2025: ScrapedPrizeData = {
  prizeKey: "MEDICINE",
  year: 2025,
  laureateCount: 3,
  fetchedAt: "2025-10-05T00:00:00Z",
  topMotivation: null,
  laureates: [
    laureate("Mary E. Brunkow", {
      gender: "female",
      birthDate: ageBirthDate(64),
      dateAwarded: "2025-10-05",
      motivation:
        "for their discoveries concerning peripheral immune tolerance",
    }),
    laureate("Fred Ramsdell", {
      birthDate: ageBirthDate(64),
      dateAwarded: "2025-10-05",
      motivation:
        "for their discoveries concerning peripheral immune tolerance",
    }),
    laureate("Shimon Sakaguchi", {
      birthDate: ageBirthDate(74),
      dateAwarded: "2025-10-05",
      motivation:
        "for their discoveries concerning peripheral immune tolerance",
    }),
  ],
};

const economics2025: ScrapedPrizeData = {
  prizeKey: "ECONOMICS",
  year: 2025,
  laureateCount: 3,
  fetchedAt: "2025-10-13T00:00:00Z",
  topMotivation: "for having explained innovation-driven economic growth",
  laureates: [
    laureate("Joel Mokyr", {
      birthDate: ageBirthDate(79),
      dateAwarded: "2025-10-13",
      affiliationName: "Northwestern University",
    }),
    laureate("Philippe Aghion", {
      birthDate: ageBirthDate(69),
      dateAwarded: "2025-10-13",
      affiliationName: "Collège de France",
    }),
    laureate("Peter Howitt", {
      birthDate: ageBirthDate(79),
      dateAwarded: "2025-10-13",
      affiliationName: "Brown University",
    }),
  ],
};

const peace2025: ScrapedPrizeData = {
  prizeKey: "PEACE",
  year: 2025,
  laureateCount: 1,
  fetchedAt: "2025-10-10T00:00:00Z",
  topMotivation: null,
  laureates: [
    laureate("María Corina Machado", {
      gender: "female",
      birthDate: ageBirthDate(58),
      dateAwarded: "2025-10-10",
      birthCountry: "Venezuela",
      birthContinent: "South America",
    }),
  ],
};

const literature2025: ScrapedPrizeData = {
  prizeKey: "LITERATURE",
  year: 2025,
  laureateCount: 1,
  fetchedAt: "2025-10-09T00:00:00Z",
  topMotivation: null,
  laureates: [
    laureate("László Krasznahorkai", {
      birthDate: ageBirthDate(71),
      dateAwarded: "2025-10-09",
      birthCountry: "Hungary",
      birthContinent: "Europe",
    }),
  ],
};

function options(prizeKey: keyof typeof PRIZE_QUESTIONS, index: number) {
  return PRIZE_QUESTIONS[prizeKey][index].options.map((o, i) => ({
    id: `${prizeKey}-${index}-${i}`,
    matchValue: o.matchValue ?? null,
  }));
}

function wholeWeekOptions(index: number) {
  return WHOLE_WEEK_QUESTIONS[index].options.map((o, i) => ({
    id: `whole-week-${index}-${i}`,
    matchValue: o.matchValue ?? null,
  }));
}

describe("gradePrizeSpecificQuestion + resolveProposal against real 2025 outcomes", () => {
  it("Physics: 3 laureates, discovery-of opening", () => {
    const countProposal = gradePrizeSpecificQuestion(
      "LAUREATE_COUNT",
      physics2025
    );
    expect(resolveProposal(countProposal, options("PHYSICS", 0))).toEqual({
      correctAnswerOptionId: "PHYSICS-0-1",
      noneMatched: false,
    }); // "3 laureates"

    const phraseProposal = gradePrizeSpecificQuestion(
      "PHRASE_DISCOVERY_OF",
      physics2025
    );
    expect(resolveProposal(phraseProposal, options("PHYSICS", 1))).toEqual({
      correctAnswerOptionId: "PHYSICS-1-0",
      noneMatched: false,
    }); // "Yes"
  });

  it("Chemistry: 3 laureates, development-of opening", () => {
    const countProposal = gradePrizeSpecificQuestion(
      "LAUREATE_COUNT",
      chemistry2025
    );
    expect(resolveProposal(countProposal, options("CHEMISTRY", 0))).toEqual({
      correctAnswerOptionId: "CHEMISTRY-0-2",
      noneMatched: false,
    }); // "3 laureates"

    const phraseProposal = gradePrizeSpecificQuestion(
      "PHRASE_DEVELOPMENT_OF",
      chemistry2025
    );
    expect(resolveProposal(phraseProposal, options("CHEMISTRY", 1))).toEqual({
      correctAnswerOptionId: "CHEMISTRY-1-0",
      noneMatched: false,
    }); // "Yes"
  });

  it("Medicine: 3 laureates, motivation contains 'discover'", () => {
    const countProposal = gradePrizeSpecificQuestion(
      "LAUREATE_COUNT",
      medicine2025
    );
    expect(resolveProposal(countProposal, options("MEDICINE", 0))).toEqual({
      correctAnswerOptionId: "MEDICINE-0-2",
      noneMatched: false,
    }); // "3 laureates"

    const phraseProposal = gradePrizeSpecificQuestion(
      "PHRASE_CONTAINS_DISCOVER",
      medicine2025
    );
    expect(resolveProposal(phraseProposal, options("MEDICINE", 1))).toEqual({
      correctAnswerOptionId: "MEDICINE-1-0",
      noneMatched: false,
    }); // "Yes"
  });

  it("Economics: 3 laureates, no MIT affiliation", () => {
    const countProposal = gradePrizeSpecificQuestion(
      "LAUREATE_COUNT",
      economics2025
    );
    expect(resolveProposal(countProposal, options("ECONOMICS", 0))).toEqual({
      correctAnswerOptionId: "ECONOMICS-0-2",
      noneMatched: false,
    }); // "3 laureates"

    const mitProposal = gradePrizeSpecificQuestion(
      "AFFILIATION_MIT",
      economics2025
    );
    expect(resolveProposal(mitProposal, options("ECONOMICS", 1))).toEqual({
      correctAnswerOptionId: "ECONOMICS-1-1",
      noneMatched: false,
    }); // "No"
  });

  it("Peace: a single individual laureate", () => {
    const typeProposal = gradePrizeSpecificQuestion(
      "PEACE_TYPE_SPLIT",
      peace2025
    );
    expect(resolveProposal(typeProposal, options("PEACE", 0))).toEqual({
      correctAnswerOptionId: "PEACE-0-0", // "Individual(s) only"
      noneMatched: false,
    });
  });

  it("falls back to noneMatched when a computed value matches no seeded option (e.g. a solo Physics prize)", () => {
    const soloPhysics: ScrapedPrizeData = {
      ...physics2025,
      laureateCount: 1,
      laureates: [physics2025.laureates[0]],
    };
    const proposal = gradePrizeSpecificQuestion("LAUREATE_COUNT", soloPhysics);
    // Physics's seeded options only cover "2" and "3" (nobeldata.md: no
    // solo Physics prize in 2006-2025) — a real solo year triggers 2.6's
    // "none matched" fallback rather than silently picking nothing.
    expect(resolveProposal(proposal, options("PHYSICS", 0))).toEqual({
      correctAnswerOptionId: null,
      noneMatched: true,
    });
  });
});

describe("gradeWholeWeekQuestion against real 2025 outcomes", () => {
  const allSix2025 = {
    PHYSICS: physics2025,
    CHEMISTRY: chemistry2025,
    MEDICINE: medicine2025,
    ECONOMICS: economics2025,
    LITERATURE: literature2025,
    PEACE: peace2025,
  };

  it("counts 2 female laureates (Brunkow, Machado) — matches nobeldata.md's 'women per year' 2025: 2", () => {
    const proposal = gradeWholeWeekQuestion(
      "WHOLE_WEEK_FEMALE_COUNT",
      allSix2025
    );
    expect(resolveProposal(proposal, wholeWeekOptions(0))).toEqual({
      correctAnswerOptionId: "whole-week-0-2", // "2"
      noneMatched: false,
    });
  });

  it("average age is ~71.6, not > 72 — 2025 isn't one of nobeldata.md's two >72 years (2015, 2017)", () => {
    const proposal = gradeWholeWeekQuestion(
      "WHOLE_WEEK_AVG_AGE_GT72",
      allSix2025
    );
    expect(resolveProposal(proposal, wholeWeekOptions(1))).toEqual({
      correctAnswerOptionId: "whole-week-1-1", // "No"
      noneMatched: false,
    });
  });

  it("no laureate is Africa-affiliated in 2025 (unlike e.g. 2018/2019's Peace laureates)", () => {
    const proposal = gradeWholeWeekQuestion(
      "WHOLE_WEEK_AFRICA_RESIDENT",
      allSix2025
    );
    expect(resolveProposal(proposal, wholeWeekOptions(2))).toEqual({
      correctAnswerOptionId: "whole-week-2-1", // "No"
      noneMatched: false,
    });
  });

  it("counts 2 Ivy League laureates in 2025 (Devoret at Yale, Howitt at Brown) and ignores look-alikes", () => {
    const withIvy = {
      ...allSix2025,
      PHYSICS: {
        ...physics2025,
        laureates: [
          laureate("Devoret", { affiliationName: "Yale University" }),
          laureate("BC", { affiliationName: "University of British Columbia" }),
          laureate("IAS", { affiliationName: "Institute for Advanced Study" }),
          laureate("PSU", { affiliationName: "Pennsylvania State University" }),
        ],
      },
      CHEMISTRY: { ...chemistry2025, laureates: [] },
      MEDICINE: { ...medicine2025, laureates: [] },
      LITERATURE: { ...literature2025, laureates: [] },
      PEACE: { ...peace2025, laureates: [] },
      ECONOMICS: {
        ...economics2025,
        laureates: [
          laureate("Howitt", { affiliationName: "Brown University" }),
        ],
      },
    };
    const proposal = gradeWholeWeekQuestion("WHOLE_WEEK_IVY_COUNT", withIvy);
    expect(proposal.computedValue).toBe("2");
    expect(resolveProposal(proposal, wholeWeekOptions(4))).toEqual({
      correctAnswerOptionId: "whole-week-4-2", // "2"
      noneMatched: false,
    });
  });

  it("buckets 4 Ivy laureates (2023-style) as '3+'", () => {
    const four = [
      "Harvard University",
      "Harvard Medical School",
      "Columbia University",
      "University of Pennsylvania",
    ].map((n, i) => laureate(`L${i}`, { affiliationName: n }));
    const proposal = gradeWholeWeekQuestion("WHOLE_WEEK_IVY_COUNT", {
      ...allSix2025,
      PHYSICS: { ...physics2025, laureates: four },
      CHEMISTRY: { ...chemistry2025, laureates: [] },
      MEDICINE: { ...medicine2025, laureates: [] },
      ECONOMICS: { ...economics2025, laureates: [] },
      LITERATURE: { ...literature2025, laureates: [] },
      PEACE: { ...peace2025, laureates: [] },
    });
    expect(proposal.computedValue).toBe("3+");
  });

  it("returns an unresolved (null) proposal when not all six prizes have been scraped yet", () => {
    const proposal = gradeWholeWeekQuestion("WHOLE_WEEK_FEMALE_COUNT", {
      PHYSICS: physics2025,
    });
    expect(proposal.computedValue).toBeNull();
    expect(resolveProposal(proposal, wholeWeekOptions(0))).toBeNull();
  });
});

describe("questions with no gradingKey are never auto-graded", () => {
  it("Literature genre and both citizenship questions have gradingKey undefined", () => {
    expect(PRIZE_QUESTIONS.LITERATURE[0].gradingKey).toBeUndefined();
    expect(PRIZE_QUESTIONS.LITERATURE[1].gradingKey).toBeUndefined();
    expect(PRIZE_QUESTIONS.PEACE[1].gradingKey).toBeUndefined();
    expect(WHOLE_WEEK_QUESTIONS[3].gradingKey).toBeUndefined();
  });
});
