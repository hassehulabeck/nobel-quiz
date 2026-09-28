import { prisma } from "@/lib/prisma";

export type VerifyEmailResult =
  "success" | "invalid" | "expired" | "already-used";

/** Consumes an email verification token. Plain server-side function (not a Server Action) for use from the `/verify` Server Component. */
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
