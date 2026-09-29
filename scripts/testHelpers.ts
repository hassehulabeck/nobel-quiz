import { prisma } from "../src/lib/prisma.ts";

/**
 * Fetches the most recent unused verification token for a user directly from
 * the DB. Reading `/tmp/nobel-quiz-dev.log` for a `[email:dev-fallback]` line
 * only worked while no real `RESEND_API_KEY` was configured (src/lib/email.ts's
 * dev fallback); once a real key is present (as of Phase 0.3), signup/reset
 * emails go out for real via Resend and are never logged, so every script
 * that scraped the log for a token silently broke. The token itself is
 * stored in plaintext in `VerificationToken.token` regardless of which path
 * sent the email, so reading it straight from the DB works in both cases and
 * doesn't depend on how (or whether) the email actually got delivered.
 */
export async function latestVerificationToken(
  email: string,
  type: "EMAIL_VERIFICATION" | "PASSWORD_RESET" = "EMAIL_VERIFICATION"
): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const token = await prisma.verificationToken.findFirst({
    where: { userId: user.id, type, usedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!token) throw new Error(`No unused ${type} token found for ${email}`);
  return token.token;
}
