import Link from "next/link";
import { consumeEmailVerificationToken } from "@/lib/auth/verifyEmail";

const MESSAGES: Record<string, { heading: string; body: string }> = {
  success: {
    heading: "Email verified!",
    body: "Your account is now active. You can log in.",
  },
  invalid: {
    heading: "Invalid link",
    body: "That verification link isn't valid. Double-check you copied the whole URL, or sign up again.",
  },
  expired: {
    heading: "Link expired",
    body: "That verification link has expired. Sign up again to get a new one.",
  },
  "already-used": {
    heading: "Already verified",
    body: "This link was already used — your account should already be active. Try logging in.",
  },
  missing: {
    heading: "Missing link",
    body: "No verification token was provided.",
  },
};

export default async function VerifyPage({
  searchParams,
}: PageProps<"/verify">) {
  const { token } = await searchParams;
  const tokenValue = Array.isArray(token) ? token[0] : token;

  const result = tokenValue
    ? await consumeEmailVerificationToken(tokenValue)
    : "missing";
  const { heading, body } = MESSAGES[result];

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto flex max-w-sm flex-1 flex-col justify-center gap-4 px-4 py-16 outline-none"
    >
      <h1 className="text-2xl font-semibold">{heading}</h1>
      <p>{body}</p>
      <Link href="/login" className="text-primary-hover underline underline-offset-2">
        Go to login
      </Link>
    </main>
  );
}
