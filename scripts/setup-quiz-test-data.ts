import "dotenv/config";
import { prisma } from "../src/lib/prisma.ts";

async function main() {
  // Physics laureate-count question -> force into "awaiting_result" (deadline passed, no Result yet).
  const physics = await prisma.question.findFirstOrThrow({
    where: { text: { contains: "share the Physics prize" } },
  });
  await prisma.question.update({
    where: { id: physics.id },
    data: { answerDeadline: new Date(Date.now() - 60 * 60 * 1000) },
  });

  // Chemistry laureate-count question -> force into "graded" with a known correct answer.
  const chemistry = await prisma.question.findFirstOrThrow({
    where: { text: { contains: "share the Chemistry prize" } },
    include: { options: true },
  });
  const chemistryCorrectOption = chemistry.options.find((o) => o.label === "3 laureates");
  await prisma.question.update({
    where: { id: chemistry.id },
    data: { answerDeadline: new Date(Date.now() - 60 * 60 * 1000) },
  });
  await prisma.result.upsert({
    where: { questionId: chemistry.id },
    update: {
      correctAnswerOptionId: chemistryCorrectOption.id,
      noneMatched: false,
      status: "APPROVED",
      approvedAt: new Date(),
    },
    create: {
      questionId: chemistry.id,
      correctAnswerOptionId: chemistryCorrectOption.id,
      noneMatched: false,
      status: "APPROVED",
      approvedAt: new Date(),
    },
  });

  // Medicine laureate-count question -> the "noneMatched" fallback case.
  const medicine = await prisma.question.findFirstOrThrow({
    where: { text: { contains: "share the Physiology or Medicine prize" } },
  });
  await prisma.question.update({
    where: { id: medicine.id },
    data: { answerDeadline: new Date(Date.now() - 60 * 60 * 1000) },
  });
  await prisma.result.upsert({
    where: { questionId: medicine.id },
    update: { correctAnswerOptionId: null, noneMatched: true, status: "APPROVED", approvedAt: new Date() },
    create: {
      questionId: medicine.id,
      correctAnswerOptionId: null,
      noneMatched: true,
      status: "APPROVED",
      approvedAt: new Date(),
    },
  });

  // Literature question -> will be used for the "deadline race" test: still open for a few
  // seconds so the form renders, then we flip its deadline into the past mid-test.
  const literature = await prisma.question.findFirstOrThrow({
    where: { text: { contains: "primary genre" } },
    include: { options: true },
  });
  await prisma.question.update({
    where: { id: literature.id },
    data: { answerDeadline: new Date(Date.now() + 5000) },
  });

  console.log(
    JSON.stringify({
      physicsQuestionId: physics.id,
      chemistryQuestionId: chemistry.id,
      chemistryCorrectOptionId: chemistryCorrectOption.id,
      chemistryCorrectOptionPoints: chemistryCorrectOption.points.toString(),
      medicineQuestionId: medicine.id,
      literatureQuestionId: literature.id,
      literatureOptionIds: literature.options.map((o) => o.id),
    })
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
