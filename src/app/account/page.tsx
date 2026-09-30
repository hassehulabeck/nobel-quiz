import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { laureateInfoFor } from "@/lib/auth/laureateNames";
import { DisplayNameForm } from "@/components/account/DisplayNameForm";

export const metadata: Metadata = { title: "Your account — Nobel Quiz" };

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const info = laureateInfoFor(user.displayName);

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-16 outline-none"
    >
      <h1 className="text-2xl font-semibold">Your account</h1>
      <p>
        You&apos;re playing as <strong>{user.displayName}</strong>
        {info ? ` (${info})` : ""}.
      </p>
      <DisplayNameForm currentName={user.displayName} />
      <p className="text-sm">
        <Link href="/" className="underline underline-offset-2">
          Back to the quiz
        </Link>
        {" · "}
        <Link href="/privacy" className="underline underline-offset-2">
          Privacy & your data
        </Link>
      </p>
    </main>
  );
}
