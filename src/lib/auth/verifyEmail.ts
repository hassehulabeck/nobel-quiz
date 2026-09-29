import { prisma } from "@/lib/prisma";

export type VerifyEmailResult =
  "success" | "invalid" | "expired" | "already-used";

/**
 * Read-only check of a token's state, with no side effects. The `/verify` page
 * uses this on GET so that mail scanners and link previewers that merely fetch
 * the URL can't burn the single-use token; only the explicit confirm action
 * (`consumeEmailVerificationToken`) does.
 */
export async function peekEmailVerificationToken(
  token: string
): Promise<Exclude<VerifyEmailResult, "success"> | "valid"> {
  const verificationToken = await prisma.verificationToken.findUnique({
    where: { token },
  });
  if (!verificationToken || verificationToken.type !== "EMAIL_VERIFICATION") {
    return "invalid";
  }
  if (verificationToken.usedAt) return "already-used";
  if (verificationToken.expiresAt < new Date()) return "expired";
  return "valid";
}

/** Consumes an email verification token. Plain server-side function (not a Server Action) called from the `confirmEmail` Server Action (never on a plain GET). */
export async function consumeEmailVerificationToken(
  token: string
): Promise<VerifyEmailResult> {
  const verificationToken = await prisma.verificationToken.findUnique({
    where: { token },
  });

  if (!verificationToken || verificationToken.type !== "EMAIL_VERIFICATION") {
    return "invalid";
  }
  if (verificationToken.usedAt) {
    return "already-used";
  }
  if (verificationToken.expiresAt < new Date()) {
    return "expired";
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: verificationToken.userId },
      data: { emailVerified: true },
    }),
    prisma.verificationToken.update({
      where: { token },
      data: { usedAt: new Date() },
    }),
  ]);

  return "success";
}
