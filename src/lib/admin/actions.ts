"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { ResultStatus } from "@/generated/prisma/enums";
import { NONE_MATCHED_SENTINEL } from "./constants";

export type ApproveResultState = { error: string } | { success: true } | null;

/**
 * TASKS.md 6.4/6.5: the only way a Result's `approvedAt` gets set — the
 * single go-live gate every player-facing page and the leaderboard already
 * read (getQuizData.ts, leaderboard.ts). Works whether or not the scheduler
 * ever produced a proposal: an admin can pick the correct answer from
 * scratch (scrape failure, or a gradingKey-less question like citizenship/
 * genre), or override whatever the scraper proposed.
 */
export async function approveResult(
  _prevState: ApproveResultState,
  formData: FormData
): Promise<ApproveResultState> {
  const user = await getCurrentUser();
  if (!user?.isAdmin) {
    return { error: "You must be an admin to do this." };
  }

  const questionId = formData.get("questionId");
  const answerOptionId = formData.get("answerOptionId");
  if (typeof questionId !== "string" || typeof answerOptionId !== "string") {
    return { error: "Pick an answer (or 'none matched') before approving." };
  }

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { options: true },
  });
  if (!question) {
    return { error: "That question no longer exists." };
  }

  const noneMatched = answerOptionId === NONE_MATCHED_SENTINEL;
  if (!noneMatched && !question.options.some((o) => o.id === answerOptionId)) {
    return { error: "That's not a valid answer for this question." };
  }

  await prisma.result.upsert({
    where: { questionId },
    create: {
      questionId,
      correctAnswerOptionId: noneMatched ? null : answerOptionId,
      noneMatched,
      status: ResultStatus.APPROVED,
      approvedAt: new Date(),
      approvedByUserId: user.id,
    },
    update: {
      correctAnswerOptionId: noneMatched ? null : answerOptionId,
      noneMatched,
      status: ResultStatus.APPROVED,
      approvedAt: new Date(),
      approvedByUserId: user.id,
    },
  });

  revalidatePath("/admin/results");
  revalidatePath("/");
  return { success: true };
}
