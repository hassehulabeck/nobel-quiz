"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { checkCustomDisplayName } from "@/lib/auth/displayNameRules";
import { isDisplayNameTaken } from "@/lib/auth/nameTaken";
import { generateToken } from "@/lib/auth/tokens";
import { enforceRateLimit, RateLimitError } from "@/lib/rateLimit";
import { GUEST_QUESTION_FIELD_PREFIX } from "./constants";
import { clearGuestCookie, getCurrentGuest, setGuestCookie } from "./session";

// Per IP, per hour. Generous enough for an office sharing one address; the
// cookie (one entry per browser) is the other half of the ballot-stuffing limit.
const GUEST_ENTRIES_PER_IP_PER_HOUR = 10;

export type GuestEntryState = { error: string } | null;

export async function submitGuestEntry(
  _prevState: GuestEntryState,
  formData: FormData
): Promise<GuestEntryState> {
  if (await getCurrentUser()) {
    return {
      error: "You're logged in — answer the questions on the start page.",
    };
  }
  const existing = await getCurrentGuest();
  if (existing) redirect(`/guest/${existing.token}`);

  // Bots fill every field; people never see this one. Pretend it worked.
  if (formData.get("website")) redirect("/");

  try {
    await enforceRateLimit(
      "guest-entry",
      GUEST_ENTRIES_PER_IP_PER_HOUR,
      60 * 60_000
    );
  } catch (err) {
    if (err instanceof RateLimitError) {
      return { error: "Too many entries from this network. Try again later." };
    }
    throw err;
  }

  const check = checkCustomDisplayName(
    String(formData.get("displayName") ?? "")
  );
  if ("error" in check) return { error: check.error };
  if (await isDisplayNameTaken(check.name)) {
    return { error: "That name is already taken" };
  }

  const picks: { questionId: string; answerOptionId: string }[] = [];
  for (const [field, value] of formData.entries()) {
    if (!field.startsWith(GUEST_QUESTION_FIELD_PREFIX)) continue;
    if (typeof value !== "string" || !value) continue;
    picks.push({
      questionId: field.slice(GUEST_QUESTION_FIELD_PREFIX.length),
      answerOptionId: value,
    });
  }
  if (picks.length === 0) return { error: "Answer at least one question." };

  const questions = await prisma.question.findMany({
    where: { id: { in: picks.map((p) => p.questionId) } },
    include: { options: { select: { id: true } } },
  });
  const byId = new Map(questions.map((q) => [q.id, q]));
  const now = new Date();
  for (const pick of picks) {
    const question = byId.get(pick.questionId);
    if (!question)
      return { error: "A question on this page no longer exists." };
    // Server-side, regardless of what the form showed.
    if (question.answerDeadline < now) {
      return {
        error: `The deadline passed for “${question.text}”. Reload the page and try again.`,
      };
    }
    if (!question.options.some((o) => o.id === pick.answerOptionId)) {
      return { error: "That's not a valid answer for one of the questions." };
    }
  }

  const token = generateToken();
  try {
    await prisma.guestPlayer.create({
      data: {
        displayName: check.name,
        token,
        submissions: { create: picks },
      },
    });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") {
      return { error: "That name is already taken" };
    }
    throw err;
  }

  await setGuestCookie(token);
  revalidatePath("/");
  redirect(`/guest/${token}`);
}

/** Removes the guest entry and all its answers. The token in the URL is the credential. */
export async function deleteGuestEntry(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  if (token) {
    await prisma.guestPlayer.deleteMany({ where: { token } });
  }
  await clearGuestCookie();
  revalidatePath("/");
  redirect("/");
}
