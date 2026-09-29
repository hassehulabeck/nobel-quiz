import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const metadata: Metadata = { title: "Set a new password — Nobel Quiz" };

export default async function ResetPasswordPage({
  searchParams,
}: PageProps<"/reset-password">) {
  const { token } = await searchParams;
  const tokenValue = Array.isArray(token) ? token[0] : token;

  if (!tokenValue) {
    return (
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto flex max-w-sm flex-1 flex-col justify-center gap-4 px-4 py-16 outline-none"
      >
        <h1 className="text-2xl font-semibold">Missing link</h1>
        <p>No reset token was provided.</p>
        <Link
          href="/forgot-password"
          className="text-primary-hover underline underline-offset-2"
        >
          Request a new reset link
        </Link>
      </main>
    );
  }

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto flex max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-16 outline-none"
    >
      <h1 className="text-2xl font-semibold">Set a new password</h1>
      <ResetPasswordForm token={tokenValue} />
    </main>
  );
}
