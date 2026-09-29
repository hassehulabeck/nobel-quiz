import { prisma } from "@/lib/prisma";

export type AdminQuestionView = {
  id: string;
  text: string;
  prizeName: string | null;
  answerDeadline: Date;
  gradingKey: string | null;
  options: { id: string; label: string }[];
  result: {
    status: "PENDING" | "PROPOSED" | "APPROVED";
    correctAnswerOptionId: string | null;
    noneMatched: boolean;
    scrapeAttempts: number;
    lastAttemptAt: Date | null;
    rawScrapedData: unknown;
    approvedAt: Date | null;
  } | null;
};

/**
 * TASKS.md 6.4: everything past its deadline, so the admin can review
 * proposed gradings, correct/enter results by hand where the scraper
 * couldn't (or shouldn't — citizenship/genre questions), and approve.
 * Already-approved questions are included too, purely so the admin page
 * can show a record of what's already live.
 */
export async function getAdminQuestions(): Promise<AdminQuestionView[]> {
  const now = new Date();
  const questions = await prisma.question.findMany({
    where: { answerDeadline: { lt: now } },
    include: {
      prize: true,
      options: { orderBy: { sortOrder: "asc" } },
      result: true,
    },
    orderBy: [{ answerDeadline: "asc" }],
  });

  return questions.map((q) => ({
    id: q.id,
    text: q.text,
    prizeName: q.prize?.name ?? null,
    answerDeadline: q.answerDeadline,
    gradingKey: q.gradingKey,
    options: q.options.map((o) => ({ id: o.id, label: o.label })),
    result: q.result
      ? {
          status: q.result.status,
          correctAnswerOptionId: q.result.correctAnswerOptionId,
          noneMatched: q.result.noneMatched,
          scrapeAttempts: q.result.scrapeAttempts,
          lastAttemptAt: q.result.lastAttemptAt,
          rawScrapedData: q.result.rawScrapedData,
          approvedAt: q.result.approvedAt,
        }
      : null,
  }));
}
