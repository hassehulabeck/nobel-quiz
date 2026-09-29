import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "@/components/auth/SignupForm";

export const metadata: Metadata = { title: "Sign up — Nobel Quiz" };

export default function SignupPage() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto flex max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-16 outline-none"
    >
      <h1 className="text-2xl font-semibold">Create your account</h1>
      <p className="text-sm text-muted-foreground">
        We store your email (to let you log in, verify your account, and send
        password-reset links), a hashed version of your password, your quiz
        answers, and your points — kept for as long as your account exists.
        Other players only ever see your display name and points, never your
        email. You can delete your account and all of its data at any time,
        immediately and permanently — see our{" "}
        <Link
          href="/privacy"
          className="text-primary-hover underline underline-offset-2"
        >
          full privacy notice
        </Link>
        .
      </p>
      <SignupForm />
      <p className="text-sm">
        Already have an account?{" "}
        <Link
          href="/login"
          className="text-primary-hover underline underline-offset-2"
        >
          Log in
        </Link>
      </p>
    </main>
  );
}
