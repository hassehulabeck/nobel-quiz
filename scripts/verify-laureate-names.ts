import { LAUREATES } from "../src/lib/auth/laureateNames.ts";

// Checks every default-name laureate against the official Nobel API:
// the person exists, the year/category in our `info` line matches an award
// they actually received, and they are deceased (we only hand out the names
// of deceased laureates as handles).

const CATEGORY: Record<string, string> = {
  Physics: "Physics",
  Chemistry: "Chemistry",
  Medicine: "Physiology or Medicine",
  Literature: "Literature",
  Peace: "Peace",
  Economics: "Economic Sciences",
};

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");

type ApiLaureate = {
  knownName?: { en?: string };
  fullName?: { en?: string };
  death?: { date?: string };
  nobelPrizes?: { awardYear: string; category: { en: string } }[];
};

async function main() {
  const res = await fetch(
    "https://api.nobelprize.org/2.1/laureates?limit=1200&format=json"
  );
  const { laureates } = (await res.json()) as { laureates: ApiLaureate[] };
  let failures = 0;
  const fail = (msg: string) => {
    failures++;
    console.log(`FAIL - ${msg}`);
  };

  for (const l of LAUREATES) {
    // The API uses full names ("Richard P. Feynman", "John F. Nash Jr."), so
    // match on first initial + last name rather than the exact string.
    const ours = l.name.replace(/\s+jr\.?$/i, "");
    const lastName = norm(ours.split(/\s+/).pop()!);
    const firstInitial = norm(ours)[0];
    const match = laureates.filter((a) => {
      const full = norm(
        (a.knownName?.en ?? a.fullName?.en ?? "")
          .replace(/\s+jr\.?$/i, "")
          .replace(/^sir\s+/i, "")
      );
      return full.startsWith(firstInitial) && full.endsWith(lastName);
    });
    if (match.length !== 1) {
      fail(`${l.name}: ${match.length} API matches`);
      continue;
    }
    const person = match[0];
    if (!person.death?.date)
      fail(`${l.name}: no death date in API (not deceased?)`);

    // "Chemistry 1958, 1980" / "Physics 1903, Chemistry 1911" / "Peace 1962"
    let category = "";
    for (const part of l.info.split(",").map((p) => p.trim())) {
      const m = part.match(/^(?:([A-Za-z]+) )?(\d{4})$/);
      if (!m) {
        fail(`${l.name}: cannot parse "${part}"`);
        continue;
      }
      category = m[1] ?? category;
      const apiCategory = CATEGORY[category];
      const ok = person.nobelPrizes?.some(
        (p) => p.awardYear === m[2] && p.category.en === apiCategory
      );
      if (!ok) fail(`${l.name}: no ${category} ${m[2]} award in API`);
    }
    // Every award the API knows about must be listed too.
    const listed = l.info.split(",").length;
    if ((person.nobelPrizes?.length ?? 0) !== listed) {
      fail(
        `${l.name}: API has ${person.nobelPrizes?.length} awards, info lists ${listed}`
      );
    }
  }
  console.log(
    failures === 0
      ? `PASS - all ${LAUREATES.length} laureates match the Nobel API and are deceased`
      : `${failures} problem(s)`
  );
  if (failures) process.exitCode = 1;
}

main();
