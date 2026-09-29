import Link from "next/link";
import { confirmEmail } from "@/lib/auth/actions";
import { peekEmailVerificationToken } from "@/lib/auth/verifyEmail";

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
  const { token, result: resultParam } = await searchParams;
  const tokenValue = Array.isArray(token) ? token[0] : token;
  const finished = Array.isArray(resultParam) ? resultParam[0] : resultParam;

  // Loading this page never consumes the token: it only reports its state and,
  // if it's still usable, asks the user to confirm with a button (a POST).
  const state =
    finished && finished in MESSAGES
      ? finished
      : tokenValue
        ? await peekEmailVerificationToken(tokenValue)
        : "missing";

  if (state === "valid" && tokenValue) {
    return (
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto flex max-w-sm flex-1 flex-col justify-center gap-4 px-4 py-16 outline-none"
      >
        <h1 className="text-2xl font-semibold">Confirm your email</h1>
        <p>Press the button below to activate your account.</p>
        <form action={confirmEmail}>
          <input type="hidden" name="token" value={tokenValue} />
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 font-medium text-white transition-colors hover:opacity-90"
          >
            Confirm my email
          </button>
        </form>
      </main>
    );
  }

  const { heading, body } =
    MESSAGES[state as keyof typeof MESSAGES] ?? MESSAGES.invalid;

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto flex max-w-sm flex-1 flex-col justify-center gap-4 px-4 py-16 outline-none"
    >
      <h1 className="text-2xl font-semibold">{heading}</h1>
      <p>{body}</p>
      <Link
        href="/login"
        className="text-primary-hover underline underline-offset-2"
      >
        Go to login
      </Link>
    </main>
  );
}
