"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

export type SubmitAnswerState = { error: string } | { success: true } | null;

export async function submitAnswer(
  _prevState: SubmitAnswerState,
  formData: FormData
): Promise<SubmitAnswerState> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "You must be logged in to answer." };
  }

  const questionId = formData.get("questionId");
  const answerOptionId = formData.get("answerOptionId");
  if (typeof questionId !== "string" || typeof answerOptionId !== "string") {
    return { error: "Pick an answer before submitting." };
  }

  const question = await prisma.question.findUnique({
    where: { id: questionId },
  });
  if (!question) {
    return { error: "That question no longer exists." };
  }

  // Enforced server-side regardless of what the client UI shows — see
  // TASKS.md 4.2.
  if (question.answerDeadline < new Date()) {
    return { error: "The deadline for this question has passed." };
  }

  const option = await prisma.answerOption.findUnique({
    where: { id: answerOptionId },
  });
  if (!option || option.questionId !== questionId) {
    return { error: "That's not a valid answer for this question." };
  }

  await prisma.submission.upsert({
    where: { userId_questionId: { userId: user.id, questionId } },
    update: { answerOptionId },
    create: { userId: user.id, questionId, answerOptionId },
  });

  revalidatePath("/");
  return { success: true };
}
