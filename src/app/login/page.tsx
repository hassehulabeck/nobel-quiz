import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Log in — Nobel Quiz" };

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const deleted = (await searchParams).deleted === "1";

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto flex max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-16 outline-none"
    >
      <h1 className="text-2xl font-semibold">Log in</h1>
      {deleted && (
        <p
          role="status"
          className="rounded-md bg-accent-tint px-3 py-2 text-sm text-accent-tint-foreground"
        >
          Your account and all its data have been deleted.
        </p>
      )}
      <LoginForm />
      <p className="text-sm">
        <Link
          href="/forgot-password"
          className="text-primary-hover underline underline-offset-2"
        >
          Forgot your password?
        </Link>
      </p>
      <p className="text-sm">
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="text-primary-hover underline underline-offset-2"
        >
          Sign up
        </Link>
      </p>
    </main>
  );
}
