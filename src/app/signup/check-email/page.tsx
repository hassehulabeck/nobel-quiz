import type { Metadata } from "next";

export const metadata: Metadata = { title: "Check your inbox — Nobel Quiz" };

export default function CheckEmailPage() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto flex max-w-sm flex-1 flex-col justify-center gap-4 px-4 py-16 outline-none"
    >
      <h1 className="text-2xl font-semibold">Check your inbox</h1>
      <p>
        We&apos;ve sent a verification link to your email address. Click it to
        activate your account, then come back and log in.
      </p>
    </main>
  );
}
