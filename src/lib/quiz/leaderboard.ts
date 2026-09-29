import { prisma } from "@/lib/prisma";
import { computeSubmissionPoints } from "@/lib/scoring";
import { isSameStockholmDay } from "@/lib/timezone";

export type LeaderboardEntry = {
  userId: string;
  displayName: string;
  totalPoints: number;
  todayPoints: number;
  rank: number;
};

/**
 * Computed on read rather than materialized (see METHODS.md / TASKS.md
 * Phase 5.2) — fine at this game's scale (dozens of users, ~16
 * questions). Only shows users who have earned points on at least one
 * graded question, matching the "top ten" framing in instructions.md.
 */
export async function computeLeaderboard(): Promise<LeaderboardEntry[]> {
  const results = await prisma.result.findMany({
    where: { approvedAt: { not: null } },
    include: { correctAnswerOption: true },
  });

  if (results.length === 0) return [];

  const questionIds = results.map((r) => r.questionId);
  const submissions = await prisma.submission.findMany({
    where: { questionId: { in: questionIds } },
    include: { user: { select: { id: true, displayName: true } } },
  });

  const submissionsByQuestion = new Map<string, typeof submissions>();
  for (const submission of submissions) {
    const list = submissionsByQuestion.get(submission.questionId) ?? [];
    list.push(submission);
    submissionsByQuestion.set(submission.questionId, list);
  }

  const now = new Date();
  const totals = new Map<
    string,
    { displayName: string; total: number; today: number }
  >();

  for (const result of results) {
    const questionSubmissions =
      submissionsByQuestion.get(result.questionId) ?? [];
    const correctOptionPoints = result.correctAnswerOption
      ? result.correctAnswerOption.points.toNumber()
      : null;

    for (const submission of questionSubmissions) {
      const points = computeSubmissionPoints(
        result,
        submission,
        correctOptionPoints
      );
      if (points === null) continue;

      const entry = totals.get(submission.userId) ?? {
        displayName: submission.user.displayName,
        total: 0,
        today: 0,
      };
      entry.total += points;
      if (result.approvedAt && isSameStockholmDay(result.approvedAt, now)) {
        entry.today += points;
      }
      totals.set(submission.userId, entry);
    }
  }

  const sorted = [...totals.entries()]
    .map(([userId, v]) => ({
      userId,
      displayName: v.displayName,
      totalPoints: v.total,
      todayPoints: v.today,
    }))
    .sort((a, b) => b.totalPoints - a.totalPoints);

  // Standard competition ranking: ties share a rank, the next rank skips ahead.
  let rank = 0;
  let lastScore: number | null = null;
  return sorted.map((entry, index) => {
    if (entry.totalPoints !== lastScore) {
      rank = index + 1;
      lastScore = entry.totalPoints;
    }
    return { ...entry, rank };
  });
}
