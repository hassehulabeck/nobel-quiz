import { prisma } from "@/lib/prisma";
import { computeSubmissionPoints } from "@/lib/scoring";

export type QuestionStatus = "open" | "awaiting_result" | "graded";

export type QuestionOptionView = {
  id: string;
  label: string;
  points: number;
};

export type QuestionView = {
  id: string;
  text: string;
  scope: "PRIZE_SPECIFIC" | "WHOLE_WEEK";
  prizeName: string | null;
  answerDeadline: Date;
  options: QuestionOptionView[];
  userAnswerOptionId: string | null;
  status: QuestionStatus;
  correctAnswerOptionId: string | null;
  noneMatched: boolean;
  pointsEarned: number | null;
};

export async function getQuizPageData(
  userId: string | null
): Promise<QuestionView[]> {
  const questions = await prisma.question.findMany({
    include: {
      prize: true,
      options: { orderBy: { sortOrder: "asc" } },
      result: { include: { correctAnswerOption: true } },
    },
    orderBy: [{ scope: "asc" }, { sortOrder: "asc" }],
  });

  const submissionByQuestionId = new Map<string, { answerOptionId: string }>();
  if (userId) {
    const submissions = await prisma.submission.findMany({
      where: { userId },
      select: { questionId: true, answerOptionId: true },
    });
    for (const submission of submissions) {
      submissionByQuestionId.set(submission.questionId, submission);
    }
  }

  const now = new Date();

  return questions.map((question) => {
    const submission = submissionByQuestionId.get(question.id) ?? null;
    const isApproved = !!question.result?.approvedAt;
    const isPastDeadline = question.answerDeadline < now;

    let status: QuestionStatus;
    if (isApproved) status = "graded";
    else if (isPastDeadline) status = "awaiting_result";
    else status = "open";

    const correctOptionPoints = question.result?.correctAnswerOption
      ? question.result.correctAnswerOption.points.toNumber()
      : null;

    const pointsEarned = question.result
      ? computeSubmissionPoints(
          question.result,
          submission,
          correctOptionPoints
        )
      : null;

    return {
      id: question.id,
      text: question.text,
      scope: question.scope,
      prizeName: question.prize?.name ?? null,
      answerDeadline: question.answerDeadline,
      options: question.options.map((o) => ({
        id: o.id,
        label: o.label,
        points: o.points.toNumber(),
      })),
      userAnswerOptionId: submission?.answerOptionId ?? null,
      status,
      correctAnswerOptionId: question.result?.correctAnswerOptionId ?? null,
      noneMatched: question.result?.noneMatched ?? false,
      pointsEarned,
    };
  });
}

/**
 * Per TASKS.md 4.5: the site switches to the end-of-week view a day after the
 * final (Economics) prize's result(s) go live. Gated on Result.approvedAt
 * (not PrizeCategory.announcementAt) so this stays consistent with Phase
 * 6.5's rule that nothing is final until an admin approves it — a delayed
 * scrape/approval delays end-of-week too, it doesn't just show at the
 * pre-scheduled time regardless.
 */
export async function isEndOfWeek(): Promise<boolean> {
  const economicsQuestions = await prisma.question.findMany({
    where: { prize: { key: "ECONOMICS" } },
    include: { result: true },
  });
  if (economicsQuestions.length === 0) return false;

  const approvedAts = economicsQuestions.map((q) => q.result?.approvedAt);
  if (approvedAts.some((approvedAt) => !approvedAt)) return false;

  const latestApprovedAt = Math.max(
    ...approvedAts.map((approvedAt) => approvedAt!.getTime())
  );
  return Date.now() > latestApprovedAt + 24 * 60 * 60 * 1000;
}
