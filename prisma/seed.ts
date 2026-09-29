import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { computePoints, roundPoints } from "../src/lib/scoring";
import { PRIZES, PRIZE_QUESTIONS, WHOLE_WEEK_QUESTIONS } from "./seedData";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

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
          gradingKey: q.gradingKey ?? null,
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
            matchValue: opt.matchValue ?? null,
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
        gradingKey: q.gradingKey ?? null,
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
          matchValue: opt.matchValue ?? null,
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
