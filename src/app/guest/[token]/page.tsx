import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { deleteGuestEntry } from "@/lib/guest/actions";
import { getQuizPageData } from "@/lib/quiz/getQuizData";
import { computeLeaderboard, guestLeaderboardId } from "@/lib/quiz/leaderboard";
import { Leaderboard } from "@/components/quiz/Leaderboard";
import { QuestionsByDay } from "@/components/quiz/QuestionsByDay";

// The URL is the credential: keep it out of search indexes and Referer headers.
export const metadata: Metadata = {
  title: "Your guest entry — Nobel Quiz",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function GuestEntryPage({
  params,
}: PageProps<"/guest/[token]">) {
  const { token } = await params;
  const guest = await prisma.guestPlayer.findUnique({ where: { token } });
  if (!guest) notFound();

  const [questions, leaderboard] = await Promise.all([
    getQuizPageData(null, guest.id),
    computeLeaderboard(),
  ]);

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-10 outline-none"
    >
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Hi {guest.displayName}</h1>
        <p>
          Your answers are locked in. Bookmark this page: the link is private to
          you, and it&apos;s how you come back to see your score.
        </p>
      </header>

      <Leaderboard
        entries={leaderboard}
        currentUserId={guestLeaderboardId(guest.id)}
      />

      <QuestionsByDay questions={questions} locked />

      <p className="text-sm">
        Want a full account so you can change answers before each deadline?{" "}
        <Link href="/signup" className="underline underline-offset-2">
          Sign up
        </Link>
        .
      </p>

      <footer className="flex flex-col gap-2 border-t border-border pt-4 text-sm text-muted-foreground">
        <p>
          We store only your chosen name and your answers. Deleting your entry
          removes both immediately.
        </p>
        <form action={deleteGuestEntry}>
          <input type="hidden" name="token" value={token} />
          <button
            type="submit"
            className="rounded-md border border-border px-3 py-1.5 font-medium text-foreground hover:bg-destructive-tint"
          >
            Delete my entry
          </button>
        </form>
      </footer>
    </main>
  );
}
