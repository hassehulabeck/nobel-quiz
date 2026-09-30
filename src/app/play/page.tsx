import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getCurrentGuest } from "@/lib/guest/session";
import { getQuizPageData, isEndOfWeek } from "@/lib/quiz/getQuizData";
import { GuestEntryForm } from "@/components/guest/GuestEntryForm";

export const metadata: Metadata = { title: "Play as a guest — Nobel Quiz" };

export default async function PlayPage() {
  if (await getCurrentUser()) redirect("/");
  const guest = await getCurrentGuest();
  if (guest) redirect(`/guest/${guest.token}`);

  const all = (await isEndOfWeek()) ? [] : await getQuizPageData(null);
  const open = all.filter((q) => q.status === "open");

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10 outline-none"
    >
      <h1 className="text-3xl font-semibold">Play as a guest</h1>
      <p>
        No account, no email. Pick a name, answer the questions and you&apos;re
        on the leaderboard. One entry per browser, and it is{" "}
        <strong>final</strong>: you can&apos;t change your answers afterwards.
        After you submit you get a private link to come back and see your score.
      </p>

      {open.length === 0 ? (
        <p className="card">
          All the questions have closed, so there&apos;s nothing left to answer.{" "}
          <Link href="/" className="underline underline-offset-2">
            Back to the start page
          </Link>
        </p>
      ) : (
        <>
          {open.length < all.length && (
            <p className="text-sm text-muted-foreground">
              Some prizes have already been announced, so only the questions
              still open are listed.
            </p>
          )}
          <GuestEntryForm questions={open} />
        </>
      )}

      <p className="text-sm">
        Want to edit your answers until each deadline?{" "}
        <Link href="/signup" className="underline underline-offset-2">
          Sign up
        </Link>{" "}
        or{" "}
        <Link href="/login" className="underline underline-offset-2">
          log in
        </Link>
        .
      </p>
    </main>
  );
}
