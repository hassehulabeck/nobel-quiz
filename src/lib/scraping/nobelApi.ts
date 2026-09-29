import type { PrizeKey } from "@/generated/prisma/enums";

/**
 * The official Nobel Prize API (api.nobelprize.org/2.1) — a public, documented
 * JSON API nobelprize.org itself publishes for programmatic use, chosen over
 * scraping nobelprize.org's HTML summary pages (which would need per-prize
 * CSS-selector maintenance and could break silently on any template change).
 * See METHODS.md's "Phase 6" entry for why, and for the citizenship/genre
 * data this API does *not* provide.
 */
const CATEGORY_CODES: Record<PrizeKey, string> = {
  PHYSICS: "phy",
  CHEMISTRY: "che",
  MEDICINE: "med",
  ECONOMICS: "eco",
  LITERATURE: "lit",
  PEACE: "pea",
};

const API_BASE = "https://api.nobelprize.org/2.1";

export type ScrapedLaureate = {
  id: string;
  name: string;
  isOrganisation: boolean;
  gender: "male" | "female" | null;
  birthDate: string | null;
  birthCountry: string | null;
  birthContinent: string | null;
  affiliationName: string | null;
  affiliationCountry: string | null;
  affiliationContinent: string | null;
  motivation: string | null;
  dateAwarded: string | null;
};

export type ScrapedPrizeData = {
  prizeKey: PrizeKey;
  year: number;
  laureateCount: number;
  laureates: ScrapedLaureate[];
  topMotivation: string | null;
  fetchedAt: string;
};

type ApiLaureate = {
  id: string;
  knownName?: { en?: string };
  orgName?: { en?: string };
  gender?: "male" | "female";
  birth?: {
    date?: string;
    place?: {
      country?: { en?: string };
      continent?: { en?: string };
    };
  };
  nobelPrizes?: Array<{
    dateAwarded?: string;
    motivation?: { en?: string };
    topMotivation?: { en?: string };
    affiliations?: Array<{
      name?: { en?: string };
      country?: { en?: string };
      continent?: { en?: string };
    }>;
  }>;
};

type ApiResponse = { laureates?: ApiLaureate[] };

/** Thrown when the API responds but has no laureates yet (not yet announced). */
export class NoLaureatesYetError extends Error {}

export async function fetchPrizeData(
  year: number,
  prizeKey: PrizeKey
): Promise<ScrapedPrizeData> {
  const code = CATEGORY_CODES[prizeKey];
  const url = `${API_BASE}/laureates?nobelPrizeYear=${year}&nobelPrizeCategory=${code}`;

  const response = await fetch(url, {
    headers: { "User-Agent": "nobel-quiz/1.0 (private, non-commercial)" },
  });
  if (!response.ok) {
    throw new Error(`Nobel API request failed: ${response.status} ${url}`);
  }

  const data = (await response.json()) as ApiResponse;
  const apiLaureates = data.laureates ?? [];
  if (apiLaureates.length === 0) {
    throw new NoLaureatesYetError(
      `No laureates yet for ${prizeKey} ${year}`
    );
  }

  let topMotivation: string | null = null;
  const laureates: ScrapedLaureate[] = apiLaureates.map((l) => {
    const prize = l.nobelPrizes?.[0];
    if (prize?.topMotivation?.en) topMotivation = prize.topMotivation.en;
    const affiliation = prize?.affiliations?.[0];
    const isOrganisation = !!l.orgName;

    return {
      id: l.id,
      name: l.knownName?.en ?? l.orgName?.en ?? "Unknown",
      isOrganisation,
      gender: isOrganisation ? null : (l.gender ?? null),
      birthDate: isOrganisation ? null : (l.birth?.date ?? null),
      birthCountry: l.birth?.place?.country?.en ?? null,
      birthContinent: l.birth?.place?.continent?.en ?? null,
      affiliationName: affiliation?.name?.en ?? null,
      affiliationCountry: affiliation?.country?.en ?? null,
      affiliationContinent: affiliation?.continent?.en ?? null,
      motivation: prize?.motivation?.en ?? null,
      dateAwarded: prize?.dateAwarded ?? null,
    };
  });

  return {
    prizeKey,
    year,
    laureateCount: laureates.length,
    laureates,
    topMotivation,
    fetchedAt: new Date().toISOString(),
  };
}

/** Fetches all six prizes for a year — used to grade whole-week questions. */
export async function fetchAllPrizesForYear(
  year: number
): Promise<Partial<Record<PrizeKey, ScrapedPrizeData>>> {
  const keys = Object.keys(CATEGORY_CODES) as PrizeKey[];
  const results = await Promise.allSettled(
    keys.map((key) => fetchPrizeData(year, key))
  );

  const byKey: Partial<Record<PrizeKey, ScrapedPrizeData>> = {};
  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      byKey[keys[index]] = result.value;
    }
  });
  return byKey;
}
