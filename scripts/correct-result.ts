/**
 * Corrects the correct answer of an ALREADY APPROVED result (e.g. the admin
 * clicked the wrong option). Only `correctAnswerOptionId`/`noneMatched` are
 * changed: `approvedAt` is kept so the points stay attributed to the day
 * the result originally went live (leaderboard "today" column). Submissions
 * are untouched — scores are computed on read, so they follow automatically.
 *
 * Dry run by default; pass --apply to write.
 *
 * Usage: node --env-file=.env node_modules/.bin/tsx scripts/correct-result.ts CHEMISTRY LAUREATE_COUNT 2 [--apply]
 *   args: <PrizeKey> <gradingKey> <option matchValue or exact label>
 * (set DATABASE_URL to the target database; for production, the Railway URL)
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const [prizeKey, gradingKey, value] = process.argv.slice(2);
const apply = process.argv.includes("--apply");
if (!prizeKey || !gradingKey || !value) {
  console.error(
    "Usage: correct-result.ts <PrizeKey> <gradingKey> <matchValue|label> [--apply]"
  );
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const question = await prisma.question.findFirst({
    where: { prize: { key: prizeKey as never }, gradingKey },
    include: {
      options: { orderBy: { sortOrder: "asc" } },
      result: true,
      _count: { select: { submissions: true, guestSubmissions: true } },
    },
  });
  if (!question) throw new Error(`No ${prizeKey} question with ${gradingKey}`);

  const { result, options } = question;
  console.log(`Question: ${question.text} (${question.id})`);
  for (const o of options) {
    const [users, guests] = await Promise.all([
      prisma.submission.count({ where: { answerOptionId: o.id } }),
      prisma.guestSubmission.count({ where: { answerOptionId: o.id } }),
    ]);
    const mark = o.id === result?.correctAnswerOptionId ? "  <- current" : "";
    console.log(
      `  [${o.matchValue ?? "-"}] ${o.label} — ${o.points} pts, picked by ${users} users + ${guests} guests${mark}`
    );
  }

  if (!result?.approvedAt) {
    throw new Error(
      "Result is not approved — use the normal admin page instead."
    );
  }
  console.log(
    `Result: status=${result.status}, noneMatched=${result.noneMatched}, approvedAt=${result.approvedAt.toISOString()}`
  );

  const target = options.find((o) => o.matchValue === value || o.label === value);
  if (!target) throw new Error(`No option with matchValue/label "${value}"`);
  if (target.id === result.correctAnswerOptionId && !result.noneMatched) {
    console.log("Already correct; nothing to do.");
    return;
  }
  console.log(`New correct answer: ${target.label}`);

  if (!apply) {
    console.log("Dry run — re-run with --apply to write.");
    return;
  }
  await prisma.result.update({
    where: { id: result.id },
    data: { correctAnswerOptionId: target.id, noneMatched: false },
  });
  console.log("Updated.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
