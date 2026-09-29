import "dotenv/config";
import { prisma } from "../src/lib/prisma.ts";
import { hashPassword } from "../src/lib/auth/password.ts";
import { computeSubmissionPoints } from "../src/lib/scoring.ts";
import { isSameStockholmDay } from "../src/lib/timezone.ts";
import { computeLeaderboard } from "../src/lib/quiz/leaderboard.ts";

// TASKS.md Phase 5.2 verify condition: "total points for a test user equals
// the sum of that user's daily scores across every prize announced so far,
// checked directly against the DB." This script grades questions across
// three distinct Stockholm calendar days for one user, then independently
// re-derives the daily/total breakdown straight from Prisma (not by calling
// computeLeaderboard twice) and diffs it against computeLeaderboard's output.

function log(step: string, ok: boolean, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"} - ${step}${extra ? ": " + extra : ""}`);
  if (!ok) process.exitCode = 1;
}

const DAY_A = new Date("2026-01-05T10:00:00Z"); // Stockholm CET, no DST
const DAY_B = new Date("2026-01-06T10:00:00Z");
const DAY_C = new Date("2026-01-07T10:00:00Z");

async function main() {
  const email = `delivered+phase5-${Date.now()}@resend.dev`;
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword("correct-horse-battery-staple"),
      displayName: `Phase5 Verify ${Date.now()}`,
      emailVerified: true,
    },
  });

  const physics = await prisma.question.findFirstOrThrow({
    where: { text: { contains: "share the Physics prize" } },
    include: { options: true },
  });
  const chemistry = await prisma.question.findFirstOrThrow({
    where: { text: { contains: "share the Chemistry prize" } },
    include: { options: true },
  });
  const economics = await prisma.question.findFirstOrThrow({
    where: { text: { contains: "share the Economic Sciences prize" } },
    include: { options: true },
  });
  const medicine = await prisma.question.findFirstOrThrow({
    where: { text: { contains: "share the Physiology or Medicine prize" } },
    include: { options: true },
  });
  const peace = await prisma.question.findFirstOrThrow({
    where: { text: { contains: "individual(s), organisation(s)" } },
    include: { options: true },
  });
  const literature = await prisma.question.findFirstOrThrow({
    where: { text: { contains: "primary genre" } },
  });

  const physicsCorrect = physics.options.find((o) => o.label === "3 laureates")!;
  const chemistryCorrect = chemistry.options.find((o) => o.label === "3 laureates")!;
  const economicsCorrect = economics.options.find((o) => o.label === "2 laureates")!;
  const medicineCorrect = medicine.options.find((o) => o.label === "2 laureates")!;
  const medicineWrongPick = medicine.options.find((o) => o.label === "1 (solo)")!;
  const peaceAnyOption = peace.options[0];

  // Day A: Physics, correct pick.
  await prisma.result.upsert({
    where: { questionId: physics.id },
    update: { correctAnswerOptionId: physicsCorrect.id, noneMatched: false, status: "APPROVED", approvedAt: DAY_A },
    create: { questionId: physics.id, correctAnswerOptionId: physicsCorrect.id, noneMatched: false, status: "APPROVED", approvedAt: DAY_A },
  });
  await prisma.submission.create({ data: { userId: user.id, questionId: physics.id, answerOptionId: physicsCorrect.id } });

  // Day B: Chemistry (correct) + Economics (correct) — two graded questions on the same day.
  await prisma.result.upsert({
    where: { questionId: chemistry.id },
    update: { correctAnswerOptionId: chemistryCorrect.id, noneMatched: false, status: "APPROVED", approvedAt: DAY_B },
    create: { questionId: chemistry.id, correctAnswerOptionId: chemistryCorrect.id, noneMatched: false, status: "APPROVED", approvedAt: DAY_B },
  });
  await prisma.submission.create({ data: { userId: user.id, questionId: chemistry.id, answerOptionId: chemistryCorrect.id } });

  await prisma.result.upsert({
    where: { questionId: economics.id },
    update: { correctAnswerOptionId: economicsCorrect.id, noneMatched: false, status: "APPROVED", approvedAt: DAY_B },
    create: { questionId: economics.id, correctAnswerOptionId: economicsCorrect.id, noneMatched: false, status: "APPROVED", approvedAt: DAY_B },
  });
  await prisma.submission.create({ data: { userId: user.id, questionId: economics.id, answerOptionId: economicsCorrect.id } });

  // Day C: Medicine (wrong pick, 0 points) + Peace (noneMatched fallback, 1 point) + Literature (never submitted, 0 points).
  await prisma.result.upsert({
    where: { questionId: medicine.id },
    update: { correctAnswerOptionId: medicineCorrect.id, noneMatched: false, status: "APPROVED", approvedAt: DAY_C },
    create: { questionId: medicine.id, correctAnswerOptionId: medicineCorrect.id, noneMatched: false, status: "APPROVED", approvedAt: DAY_C },
  });
  await prisma.submission.create({ data: { userId: user.id, questionId: medicine.id, answerOptionId: medicineWrongPick.id } });

  await prisma.result.upsert({
    where: { questionId: peace.id },
    update: { correctAnswerOptionId: null, noneMatched: true, status: "APPROVED", approvedAt: DAY_C },
    create: { questionId: peace.id, correctAnswerOptionId: null, noneMatched: true, status: "APPROVED", approvedAt: DAY_C },
  });
  await prisma.submission.create({ data: { userId: user.id, questionId: peace.id, answerOptionId: peaceAnyOption.id } });

  await prisma.result.upsert({
    where: { questionId: literature.id },
    update: { correctAnswerOptionId: null, noneMatched: true, status: "APPROVED", approvedAt: DAY_C },
    create: { questionId: literature.id, correctAnswerOptionId: null, noneMatched: true, status: "APPROVED", approvedAt: DAY_C },
  });
  // Deliberately no submission for literature — must score 0, not the noneMatched fallback.

  // --- Independent re-derivation, straight from the DB, not sharing any aggregation code with leaderboard.ts ---
  const allApprovedResults = await prisma.result.findMany({
    where: { questionId: { in: [physics.id, chemistry.id, economics.id, medicine.id, peace.id, literature.id] } },
    include: { correctAnswerOption: true },
  });
  const submissionsForUser = await prisma.submission.findMany({
    where: { userId: user.id, questionId: { in: allApprovedResults.map((r) => r.questionId) } },
  });
  const submissionByQuestionId = new Map(submissionsForUser.map((s) => [s.questionId, s]));

  const dayBuckets: { day: Date; points: number }[] = [];
  for (const result of allApprovedResults) {
    const submission = submissionByQuestionId.get(result.questionId) ?? null;
    const correctOptionPoints = result.correctAnswerOption ? result.correctAnswerOption.points.toNumber() : null;
    const points = computeSubmissionPoints(result, submission, correctOptionPoints) ?? 0;

    const bucket = dayBuckets.find((b) => isSameStockholmDay(b.day, result.approvedAt!));
    if (bucket) bucket.points += points;
    else dayBuckets.push({ day: result.approvedAt!, points });
  }

  log("independent derivation found exactly 3 distinct calendar days", dayBuckets.length === 3, JSON.stringify(dayBuckets.map((b) => b.points)));

  const dailySum = dayBuckets.reduce((acc, b) => acc + b.points, 0);
  const expectedTotal = 7.3;
  log(
    "sum of independently-derived daily scores matches the hand-computed expectation",
    Math.abs(dailySum - expectedTotal) < 1e-9,
    `${dailySum} vs expected ${expectedTotal}`
  );

  const leaderboard = await computeLeaderboard();
  const entry = leaderboard.find((e) => e.userId === user.id);
  log("test user appears on the leaderboard", !!entry);
  log(
    "computeLeaderboard's totalPoints matches the sum of independently-derived daily scores",
    !!entry && Math.abs(entry.totalPoints - dailySum) < 1e-9,
    `leaderboard=${entry?.totalPoints} vs daily-sum=${dailySum}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
