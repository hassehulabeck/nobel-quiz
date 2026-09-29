import { prisma } from "@/lib/prisma";
import { ResultStatus } from "@/generated/prisma/enums";
import {
  fetchAllPrizesForYear,
  fetchPrizeData,
  NoLaureatesYetError,
} from "./nobelApi";
import {
  gradePrizeSpecificQuestion,
  gradeWholeWeekQuestion,
  resolveProposal,
} from "./grader";

/**
 * TASKS.md 6.2: start attempting 5 minutes after announcement, retry
 * regularly, stop (and flag for admin) after a bounded window. Numbers
 * chosen for a once-a-week, six-prize game — not tuned for high frequency.
 */
export const ATTEMPT_DELAY_AFTER_DEADLINE_MS = 5 * 60 * 1000;
export const RETRY_INTERVAL_MS = 15 * 60 * 1000;
export const MAX_ATTEMPTS = 96; // ~24h of retries at 15-minute intervals

export type SchedulableTarget = {
  dueAt: Date;
  resultStatus: (typeof ResultStatus)[keyof typeof ResultStatus] | "NOT_STARTED";
  scrapeAttempts: number;
  lastAttemptAt: Date | null;
};

/**
 * Pure decision function — no I/O — so TASKS.md 6.2's verify condition
 * ("mocked announcement time 2 minutes ago -> no attempt yet; 6 minutes
 * ago -> one attempt fires") can be checked without a real clock or a
 * real scrape.
 */
export function shouldAttempt(target: SchedulableTarget, now: Date): boolean {
  if (target.resultStatus === ResultStatus.APPROVED) return false;
  // PROPOSED means a grading is already waiting on the admin — don't re-scrape.
  if (target.resultStatus === ResultStatus.PROPOSED) return false;
  if (now.getTime() < target.dueAt.getTime() + ATTEMPT_DELAY_AFTER_DEADLINE_MS) {
    return false;
  }
  if (target.scrapeAttempts >= MAX_ATTEMPTS) return false;
  if (
    target.lastAttemptAt &&
    now.getTime() - target.lastAttemptAt.getTime() < RETRY_INTERVAL_MS
  ) {
    return false;
  }
  return true;
}

async function ensureResultRow(questionId: string) {
  return prisma.result.upsert({
    where: { questionId },
    create: { questionId },
    update: {},
  });
}

async function recordAttempt(questionId: string, now: Date) {
  await prisma.result.update({
    where: { questionId },
    data: { scrapeAttempts: { increment: 1 }, lastAttemptAt: now },
  });
}

async function proposeResult(
  questionId: string,
  resolved: { correctAnswerOptionId: string | null; noneMatched: boolean },
  rawScrapedData: unknown
) {
  await prisma.result.update({
    where: { questionId },
    data: {
      correctAnswerOptionId: resolved.correctAnswerOptionId,
      noneMatched: resolved.noneMatched,
      status: ResultStatus.PROPOSED,
      rawScrapedData: rawScrapedData as object,
    },
  });
}

async function maybeGradePrizeSpecificQuestion(
  prizeKey: string,
  question: {
    id: string;
    gradingKey: string | null;
    answerDeadline: Date;
    options: { id: string; matchValue: string | null }[];
  },
  now: Date
) {
  if (!question.gradingKey) return; // manual-only question, scheduler skips it

  const result = await ensureResultRow(question.id);
  const target: SchedulableTarget = {
    dueAt: question.answerDeadline,
    resultStatus: result.status,
    scrapeAttempts: result.scrapeAttempts,
    lastAttemptAt: result.lastAttemptAt,
  };
  if (!shouldAttempt(target, now)) return;

  await recordAttempt(question.id, now);

  try {
    const year = question.answerDeadline.getUTCFullYear();
    const data = await fetchPrizeData(
      year,
      prizeKey as Parameters<typeof fetchPrizeData>[1]
    );
    const proposal = gradePrizeSpecificQuestion(question.gradingKey, data);
    const resolved = resolveProposal(proposal, question.options);
    if (resolved) {
      await proposeResult(question.id, resolved, proposal.rawScrapedData);
    }
  } catch (err) {
    if (err instanceof NoLaureatesYetError) return; // expected pre-announcement; will retry
    console.error(
      `[scheduler] scrape failed for question ${question.id} (${prizeKey}):`,
      err
    );
  }
}

async function maybeGradeWholeWeekQuestion(
  question: {
    id: string;
    gradingKey: string | null;
    answerDeadline: Date;
    options: { id: string; matchValue: string | null }[];
  },
  now: Date
) {
  if (!question.gradingKey) return;

  const result = await ensureResultRow(question.id);
  const target: SchedulableTarget = {
    dueAt: question.answerDeadline,
    resultStatus: result.status,
    scrapeAttempts: result.scrapeAttempts,
    lastAttemptAt: result.lastAttemptAt,
  };
  if (!shouldAttempt(target, now)) return;

  await recordAttempt(question.id, now);

  try {
    const year = question.answerDeadline.getUTCFullYear();
    const dataByPrize = await fetchAllPrizesForYear(year);
    const proposal = gradeWholeWeekQuestion(question.gradingKey, dataByPrize);
    const resolved = resolveProposal(proposal, question.options);
    if (resolved) {
      await proposeResult(question.id, resolved, proposal.rawScrapedData);
    }
  } catch (err) {
    console.error(
      `[scheduler] whole-week scrape failed for question ${question.id}:`,
      err
    );
  }
}

/** One scheduler tick: checks every gradable question and scrapes/grades those that are due. */
export async function runSchedulerTick(now: Date = new Date()): Promise<void> {
  const prizes = await prisma.prizeCategory.findMany({
    include: {
      questions: { include: { options: true } },
    },
  });

  for (const prize of prizes) {
    for (const question of prize.questions) {
      if (question.scope !== "PRIZE_SPECIFIC") continue;
      await maybeGradePrizeSpecificQuestion(prize.key, question, now);
    }
  }

  const wholeWeekQuestions = await prisma.question.findMany({
    where: { scope: "WHOLE_WEEK" },
    include: { options: true },
  });
  for (const question of wholeWeekQuestions) {
    await maybeGradeWholeWeekQuestion(question, now);
  }
}
