/**
 * Adds ONE whole-week question from prisma/seedData.ts to an already-seeded
 * database, without touching users, submissions or other questions (unlike
 * prisma/seed.ts, which wipes them — never run that once players exist).
 * Idempotent: does nothing if a question with that gradingKey exists.
 *
 * Usage: node --env-file=.env node_modules/.bin/tsx scripts/add-whole-week-question.ts WHOLE_WEEK_IVY_COUNT
 * (set DATABASE_URL to the target database; for production, the Railway URL)
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { computePoints, roundPoints } from "../src/lib/scoring";
import { WHOLE_WEEK_QUESTIONS } from "./../prisma/seedData";

const gradingKey = process.argv[2];
const def = WHOLE_WEEK_QUESTIONS.find((q) => q.gradingKey === gradingKey);
if (!def) {
  console.error(
    `No whole-week question with gradingKey "${gradingKey}" in seedData.ts`
  );
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const existing = await prisma.question.findFirst({
    where: { scope: "WHOLE_WEEK", gradingKey },
  });
  if (existing) {
    console.log(`Already present (${existing.id}); nothing to do.`);
    return;
  }

  // Same deadline as the other whole-week questions (Physics announcement).
  const siblings = await prisma.question.findMany({
    where: { scope: "WHOLE_WEEK" },
    orderBy: { sortOrder: "desc" },
  });
  if (siblings.length === 0)
    throw new Error("No whole-week questions found; is the DB seeded?");

  const question = await prisma.question.create({
    data: {
      prizeId: null,
      scope: "WHOLE_WEEK",
      text: def!.text,
      answerDeadline: siblings[0].answerDeadline,
      sortOrder: siblings[0].sortOrder + 1,
      gradingKey,
      options: {
        create: def!.options.map((opt, i) => ({
          label: opt.label,
          historicalCount: opt.historicalCount,
          historicalTotal: opt.historicalTotal,
          points: roundPoints(
            computePoints(opt.historicalCount, opt.historicalTotal)
          ),
          sortOrder: i,
          matchValue: opt.matchValue ?? null,
        })),
      },
    },
    include: { options: true },
  });
  console.log(
    `Added question ${question.id} with ${question.options.length} options.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
