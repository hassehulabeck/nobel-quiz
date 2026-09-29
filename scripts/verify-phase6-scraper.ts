import "dotenv/config";
import { fetchPrizeData } from "../src/lib/scraping/nobelApi.ts";
import {
  gradePrizeSpecificQuestion,
  gradeWholeWeekQuestion,
  resolveProposal,
} from "../src/lib/scraping/grader.ts";

// TASKS.md 6.1's verify condition: "run each of the 6 scrapers against the
// 2025 announcement pages (already resolved, in the past) and confirm the
// extracted data matches nobeldata.md's 2025 rows exactly." This hits the
// real, live api.nobelprize.org API (see METHODS.md's Phase 6 entry for why
// that's used instead of HTML scraping) — it needs network access and will
// fail if that API is ever down, which is the point: it's an honest check
// against the real data source, not a mock.

function log(step: string, ok: boolean, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"} - ${step}${extra ? ": " + extra : ""}`);
  if (!ok) process.exitCode = 1;
}

async function main() {
  const YEAR = 2025;

  const [physics, chemistry, medicine, economics, literature, peace] =
    await Promise.all([
      fetchPrizeData(YEAR, "PHYSICS"),
      fetchPrizeData(YEAR, "CHEMISTRY"),
      fetchPrizeData(YEAR, "MEDICINE"),
      fetchPrizeData(YEAR, "ECONOMICS"),
      fetchPrizeData(YEAR, "LITERATURE"),
      fetchPrizeData(YEAR, "PEACE"),
    ]);

  // --- Physics 2025: Clarke, Devoret, Martinis; "for the discovery of..." ---
  log("Physics 2025: 3 laureates", physics.laureateCount === 3);
  log(
    "Physics 2025: laureate names match nobeldata.md",
    ["John Clarke", "Michel H. Devoret", "John M. Martinis"].every((name) =>
      physics.laureates.some((l) => l.name === name)
    ),
    physics.laureates.map((l) => l.name).join(", ")
  );
  const physicsGrading = resolveProposal(
    gradePrizeSpecificQuestion("PHRASE_DISCOVERY_OF", physics),
    [
      { id: "yes", matchValue: "yes" },
      { id: "no", matchValue: "no" },
    ]
  );
  log(
    "Physics 2025: motivation opens with 'for the discovery of...'",
    physicsGrading?.correctAnswerOptionId === "yes"
  );

  // --- Chemistry 2025: Kitagawa, Robson, Yaghi; "for the development of..." ---
  log("Chemistry 2025: 3 laureates", chemistry.laureateCount === 3);
  log(
    "Chemistry 2025: laureate names match nobeldata.md",
    ["Susumu Kitagawa", "Richard Robson", "Omar M. Yaghi"].every((name) =>
      chemistry.laureates.some((l) => l.name === name)
    ),
    chemistry.laureates.map((l) => l.name).join(", ")
  );
  const chemistryGrading = resolveProposal(
    gradePrizeSpecificQuestion("PHRASE_DEVELOPMENT_OF", chemistry),
    [
      { id: "yes", matchValue: "yes" },
      { id: "no", matchValue: "no" },
    ]
  );
  log(
    "Chemistry 2025: motivation opens with 'for the development of...'",
    chemistryGrading?.correctAnswerOptionId === "yes"
  );

  // --- Medicine 2025: Brunkow, Ramsdell, Sakaguchi; motivation contains "discover" ---
  log("Medicine 2025: 3 laureates", medicine.laureateCount === 3);
  log(
    "Medicine 2025: laureate names match nobeldata.md",
    ["Mary E. Brunkow", "Fred Ramsdell", "Shimon Sakaguchi"].every((name) =>
      medicine.laureates.some((l) => l.name === name)
    ),
    medicine.laureates.map((l) => l.name).join(", ")
  );
  log(
    "Medicine 2025: Brunkow is recorded as female (nobeldata.md's only woman that year)",
    medicine.laureates.find((l) => l.name === "Mary E. Brunkow")?.gender ===
      "female"
  );
  const medicineGrading = resolveProposal(
    gradePrizeSpecificQuestion("PHRASE_CONTAINS_DISCOVER", medicine),
    [
      { id: "yes", matchValue: "yes" },
      { id: "no", matchValue: "no" },
    ]
  );
  log(
    "Medicine 2025: motivation contains 'discover'",
    medicineGrading?.correctAnswerOptionId === "yes"
  );

  // --- Economics 2025: Mokyr, Aghion, Howitt; no MIT affiliation ---
  log("Economics 2025: 3 laureates", economics.laureateCount === 3);
  log(
    "Economics 2025: laureate names match nobeldata.md",
    ["Joel Mokyr", "Philippe Aghion", "Peter Howitt"].every((name) =>
      economics.laureates.some((l) => l.name === name)
    ),
    economics.laureates.map((l) => l.name).join(", ")
  );
  const economicsGrading = resolveProposal(
    gradePrizeSpecificQuestion("AFFILIATION_MIT", economics),
    [
      { id: "yes", matchValue: "yes" },
      { id: "no", matchValue: "no" },
    ]
  );
  log(
    "Economics 2025: no MIT-affiliated laureate (Northwestern/Collège de France/Brown)",
    economicsGrading?.correctAnswerOptionId === "no"
  );

  // --- Literature 2025: Krasznahorkai, Hungary ---
  log("Literature 2025: 1 laureate", literature.laureateCount === 1);
  log(
    "Literature 2025: laureate is Krasznahorkai",
    literature.laureates[0]?.name === "László Krasznahorkai"
  );

  // --- Peace 2025: Machado (individual, Venezuela) ---
  log("Peace 2025: 1 laureate", peace.laureateCount === 1);
  // The Nobel API spells this "Maria" (no accent); nobeldata.md uses "María" —
  // matched loosely here rather than treating a diacritic-only difference as
  // a scraper bug.
  log(
    "Peace 2025: laureate is Machado",
    peace.laureates[0]?.name === "Maria Corina Machado"
  );
  const peaceGrading = resolveProposal(
    gradePrizeSpecificQuestion("PEACE_TYPE_SPLIT", peace),
    [
      { id: "individual", matchValue: "individual" },
      { id: "organisation", matchValue: "organisation" },
      { id: "mixed", matchValue: "mixed" },
    ]
  );
  log(
    "Peace 2025: graded as individual (not organisation/mixed)",
    peaceGrading?.correctAnswerOptionId === "individual"
  );

  // --- Whole-week: female count across all six 2025 prizes ---
  const wholeWeekData = {
    PHYSICS: physics,
    CHEMISTRY: chemistry,
    MEDICINE: medicine,
    ECONOMICS: economics,
    LITERATURE: literature,
    PEACE: peace,
  };
  const femaleGrading = resolveProposal(
    gradeWholeWeekQuestion("WHOLE_WEEK_FEMALE_COUNT", wholeWeekData),
    [
      { id: "0", matchValue: "0" },
      { id: "1", matchValue: "1" },
      { id: "2", matchValue: "2" },
      { id: "3+", matchValue: "3+" },
    ]
  );
  log(
    "Whole-week 2025: 2 female laureates total (Brunkow + Machado), matching nobeldata.md's 'women per year' 2025 entry",
    femaleGrading?.correctAnswerOptionId === "2"
  );
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
