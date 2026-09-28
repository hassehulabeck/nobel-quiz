import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { computePoints, roundPoints } from "../src/lib/scoring";

/**
 * 2026 Nobel week content (Phase 2 of TASKS.md). All historical
 * frequencies below are read directly from nobeldata.md's per-prize
 * tables and summaries, or computed from the raw per-laureate rows in
 * those tables — see the inline comment on each question for the source.
 *
 * 2026 announcement dates confirmed 2026-09-28 (see METHODS.md):
 * Medicine 5 Oct, Physics 6 Oct, Chemistry 7 Oct, Literature 8 Oct,
 * Peace 9 Oct, Economics 12 Oct. Times are placeholders based on the
 * typical historical announcement hour for each prize (CEST) converted
 * to UTC — nobelprize.org does not publish exact times this far ahead;
 * reconfirm and adjust once they do, ideally automatically pulled at
 * Phase 6 rather than hand-edited here.
 */

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

type OptionInput = {
  label: string;
  historicalCount: number;
  historicalTotal: number;
};

function option(
  label: string,
  historicalCount: number,
  historicalTotal: number
): OptionInput {
  return { label, historicalCount, historicalTotal };
}

const PRIZES = [
  {
    key: "MEDICINE" as const,
    name: "Physiology or Medicine",
    announcementAt: new Date("2026-10-05T09:30:00Z"),
  },
  {
    key: "PHYSICS" as const,
    name: "Physics",
    announcementAt: new Date("2026-10-06T09:45:00Z"),
  },
  {
    key: "CHEMISTRY" as const,
    name: "Chemistry",
    announcementAt: new Date("2026-10-07T09:45:00Z"),
  },
  {
    key: "LITERATURE" as const,
    name: "Literature",
    announcementAt: new Date("2026-10-08T11:00:00Z"),
  },
  {
    key: "PEACE" as const,
    name: "Peace",
    announcementAt: new Date("2026-10-09T09:00:00Z"),
  },
  {
    key: "ECONOMICS" as const,
    name: "Economic Sciences",
    announcementAt: new Date("2026-10-12T09:45:00Z"),
  },
];

const PRIZE_QUESTIONS: Record<
  (typeof PRIZES)[number]["key"],
  { text: string; options: OptionInput[] }[]
> = {
  PHYSICS: [
    {
      // nobeldata.md Tab 1 summary: 7 years with two laureates, 13 with
      // three, no solo prizes in 2006-2025.
      text: "How many laureates will share the Physics prize?",
      options: [option("2 laureates", 7, 20), option("3 laureates", 13, 20)],
    },
    {
      // nobeldata.md "Physics citation openings": the discovery-family
      // opening ("for the discovery of/that...", including "for their
      // discovery of" and "for the theoretical discovery of") covers
      // 10 of 20 years.
      text: "Will the Physics motivation start with a 'for the discovery of...' style opening?",
      options: [option("Yes", 10, 20), option("No — something else", 10, 20)],
    },
  ],
  CHEMISTRY: [
    {
      // nobeldata.md Tab 2 summary: 3 solo years, 3 two-laureate years,
      // 14 three-laureate years.
      text: "How many laureates will share the Chemistry prize?",
      options: [
        option("1 (solo)", 3, 20),
        option("2 laureates", 3, 20),
        option("3 laureates", 14, 20),
      ],
    },
    {
      // nobeldata.md "Chemistry citation openings": "for the development
      // of..." (7 years) + "for developing..." (1 year) = 8 of 20.
      text: "Will the Chemistry motivation start with a 'for the development of...' style opening?",
      options: [option("Yes", 8, 20), option("No — something else", 12, 20)],
    },
  ],
  MEDICINE: [
    {
      // nobeldata.md Tab 3 summary: 3 solo years, 6 two-laureate years,
      // 11 three-laureate years.
      text: "How many laureates will share the Physiology or Medicine prize?",
      options: [
        option("1 (solo)", 3, 20),
        option("2 laureates", 6, 20),
        option("3 laureates", 11, 20),
      ],
    },
    {
      // nobeldata.md TL;DR: "some form of 'discover-' appears in 19 of
      // 20 years" for Medicine specifically.
      text: "Will the Medicine motivation contain some form of the word 'discover'?",
      options: [option("Yes", 19, 20), option("No", 1, 20)],
    },
  ],
  ECONOMICS: [
    {
      // nobeldata.md Tab 4 summary: 6 solo years, 6 two-laureate years,
      // 8 three-laureate years.
      text: "How many laureates will share the Economic Sciences prize?",
      options: [
        option("1 (solo)", 6, 20),
        option("2 laureates", 6, 20),
        option("3 laureates", 8, 20),
      ],
    },
    {
      // nobeldata.md "Affiliation frequency": "MIT: 7 laureates, in 5 of
      // the 20 prize years" — i.e. at least one MIT-affiliated Economics
      // laureate in 5 of 20 years.
      text: "Will at least one Economics laureate be affiliated with MIT?",
      options: [option("Yes", 5, 20), option("No", 15, 20)],
    },
  ],
  LITERATURE: [
    {
      // nobeldata.md Tab 5 summary: prose 15, poetry 2, other 3 (of 20).
      text: "What will be the primary genre of this year's Literature laureate's work?",
      options: [
        option("Prose", 15, 20),
        option("Poetry", 2, 20),
        option(
          "Other (e.g. drama, song lyrics, documentary non-fiction)",
          3,
          20
        ),
      ],
    },
    {
      // nobeldata.md Tab 5 summary: "US citizens: 2 (Dylan and Glück)".
      text: "Will this year's Literature laureate be a US citizen?",
      options: [option("Yes", 2, 20), option("No", 18, 20)],
    },
  ],
  PEACE: [
    {
      // Computed from nobeldata.md Tab 6's year-by-year laureate list:
      // organisation-only years (2012, 2013, 2015, 2017, 2020, 2024) = 6;
      // mixed individual+organisation years (2006, 2007, 2022) = 3;
      // the remaining 11 years were individual-only.
      text: "Will the Peace prize go to individual(s), organisation(s), or a mix of both?",
      options: [
        option("Individual(s) only", 11, 20),
        option("Organisation(s) only", 6, 20),
        option("A mix of individual(s) and organisation(s)", 3, 20),
      ],
    },
    {
      // nobeldata.md Tab 6 summary: "US citizens: Gore, Obama and Ressa
      // (dual)" — 3 of 20 years.
      text: "Will at least one Peace laureate be a US citizen?",
      options: [option("Yes", 3, 20), option("No", 17, 20)],
    },
  ],
};

const WHOLE_WEEK_QUESTIONS: { text: string; options: OptionInput[] }[] = [
  {
    // nobeldata.md "Women per year" list, re-bucketed from the 20
    // individual year values (0,1,1,5,0,3,0,1,2,2,0,0,4,1,4,1,2,4,1,2):
    // 0 female laureates in 5 years, 1 in 6, 2 in 4, 3-or-more in 5.
    text: "How many female laureates will there be in total, across all six prizes?",
    options: [
      option("0", 5, 20),
      option("1", 6, 20),
      option("2", 4, 20),
      option("3 or more", 5, 20),
    ],
  },
  {
    // Computed from the full per-laureate age tables across all six
    // prizes, 2006-2025 (organisations excluded, "~" ages taken at face
    // value): only 2015 (72.8) and 2017 (74.0) had an average laureate
    // age above 72.
    text: "Will the average age of all of this year's laureates be more than 72?",
    options: [option("Yes", 2, 20), option("No", 18, 20)],
  },
  {
    // nobeldata.md "Living in Africa at the time of the award": clear
    // cases are all Peace laureates — 2011 (Sirleaf, Gbowee), 2015
    // (Tunisian Quartet), 2018 (Mukwege), 2019 (Abiy Ahmed) = 4 of 20
    // years. Le Clézio (Literature 2008) is excluded as nobeldata.md
    // itself flags his residence as a disputed/partial case.
    text: "Will any laureate be residing in Africa at the time of the award?",
    options: [option("Yes", 4, 20), option("No", 16, 20)],
  },
  {
    // Computed per-year from every laureate's citizenship field across
    // all six prizes (counting each "US" mention, including dual
    // citizens, once per laureate; organisations contribute 0). Bucket
    // counts cross-checked against nobeldata.md's approximate per-prize
    // cumulative totals (exact match for Literature and Peace, within a
    // few for the others) — see METHODS.md for the caveat on citizenship
    // data reliability.
    text: "How many American citizens will there be among this year's laureates, across all six prizes?",
    options: [
      option("6 or fewer", 11, 20),
      option("7-8", 7, 20),
      option("9 or more", 2, 20),
    ],
  },
];

async function main() {
  // Idempotent: clear previously-seeded question content (but not users)
  // so this script can be re-run safely as question text/odds are tuned.
  await prisma.submission.deleteMany({});
  await prisma.result.deleteMany({});
  await prisma.answerOption.deleteMany({});
  await prisma.question.deleteMany({});

  const prizeIdByKey = new Map<string, string>();

  for (const p of PRIZES) {
    const created = await prisma.prizeCategory.upsert({
      where: { key: p.key },
      update: { name: p.name, announcementAt: p.announcementAt },
      create: { key: p.key, name: p.name, announcementAt: p.announcementAt },
    });
    prizeIdByKey.set(p.key, created.id);
  }

  const physicsDeadline = PRIZES.find(
    (p) => p.key === "PHYSICS"
  )!.announcementAt;

  let questionsCreated = 0;
  let optionsCreated = 0;

  for (const prize of PRIZES) {
    const questions = PRIZE_QUESTIONS[prize.key];
    for (const [index, q] of questions.entries()) {
      const question = await prisma.question.create({
        data: {
          prizeId: prizeIdByKey.get(prize.key)!,
          scope: "PRIZE_SPECIFIC",
          text: q.text,
          answerDeadline: prize.announcementAt,
          sortOrder: index,
        },
      });
      questionsCreated++;

      for (const [optIndex, opt] of q.options.entries()) {
        await prisma.answerOption.create({
          data: {
            questionId: question.id,
            label: opt.label,
            historicalCount: opt.historicalCount,
            historicalTotal: opt.historicalTotal,
            points: roundPoints(
              computePoints(opt.historicalCount, opt.historicalTotal)
            ),
            sortOrder: optIndex,
          },
        });
        optionsCreated++;
      }
    }
  }

  for (const [index, q] of WHOLE_WEEK_QUESTIONS.entries()) {
    const question = await prisma.question.create({
      data: {
        prizeId: null,
        scope: "WHOLE_WEEK",
        text: q.text,
        answerDeadline: physicsDeadline,
        sortOrder: index,
      },
    });
    questionsCreated++;

    for (const [optIndex, opt] of q.options.entries()) {
      await prisma.answerOption.create({
        data: {
          questionId: question.id,
          label: opt.label,
          historicalCount: opt.historicalCount,
          historicalTotal: opt.historicalTotal,
          points: roundPoints(
            computePoints(opt.historicalCount, opt.historicalTotal)
          ),
          sortOrder: optIndex,
        },
      });
      optionsCreated++;
    }
  }

  console.log(
    `Seeded ${PRIZES.length} prizes, ${questionsCreated} questions, ${optionsCreated} answer options.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
