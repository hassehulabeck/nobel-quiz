import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { logout } from "@/lib/auth/actions";
import { getQuizPageData, isEndOfWeek } from "@/lib/quiz/getQuizData";
import { computeLeaderboard } from "@/lib/quiz/leaderboard";
import { QuestionForm } from "@/components/quiz/QuestionForm";
import {
  QuestionAwaitingResult,
  QuestionGraded,
} from "@/components/quiz/QuestionReadOnly";
import { Leaderboard } from "@/components/quiz/Leaderboard";
import { FullLeaderboard } from "@/components/quiz/FullLeaderboard";

export default async function Home() {
  const user = await getCurrentUser();
  const endOfWeek = await isEndOfWeek();

  if (endOfWeek) {
    const leaderboard = await computeLeaderboard();
    const questions = user ? await getQuizPageData(user.id) : [];

    return (
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-16 outline-none"
      >
        <div>
          <h1 className="text-3xl font-semibold">Nobel Quiz — final results</h1>
          <p className="mt-2 text-muted-foreground">
            That&apos;s a wrap for this year. Check back in a year!
          </p>
        </div>
        <FullLeaderboard entries={leaderboard} currentUserId={user?.id} />
        {user && (
          <section className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold">Your answers this year</h2>
            {questions.map((question) => (
              <QuestionGraded key={question.id} question={question} />
            ))}
          </section>
        )}
        {user && (
          <footer className="text-sm text-muted-foreground">
            <Link
              href="/privacy"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Privacy & your data
            </Link>
          </footer>
        )}
      </main>
    );
  }

  if (!user) {
    return (
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-16 text-center outline-none"
      >
        <h1 className="text-3xl font-semibold">Nobel Quiz</h1>
        <p className="text-muted-foreground">
          Guess this year&apos;s Nobel prize outcomes.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link href="/login" className="btn-primary">
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-md border border-border px-4 py-2 font-medium hover:bg-warning-tint"
          >
            Sign up
          </Link>
        </div>
      </main>
    );
  }

  const [questions, leaderboard] = await Promise.all([
    getQuizPageData(user.id),
    computeLeaderboard(),
  ]);

  const open = questions.filter((q) => q.status === "open");
  const awaiting = questions.filter((q) => q.status === "awaiting_result");
  const graded = questions.filter((q) => q.status === "graded");

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-16 outline-none"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Welcome, {user.displayName}</h1>
        <form action={logout}>
          <button
            type="submit"
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-warning-tint"
          >
            Log out
          </button>
        </form>
      </header>

      <Leaderboard entries={leaderboard} currentUserId={user.id} />

      {open.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">Open questions</h2>
          {open.map((question) => (
            <QuestionForm key={question.id} question={question} />
          ))}
        </section>
      )}

      {awaiting.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">Awaiting results</h2>
          {awaiting.map((question) => (
            <QuestionAwaitingResult key={question.id} question={question} />
          ))}
        </section>
      )}

      {graded.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">Results</h2>
          {graded.map((question) => (
            <QuestionGraded key={question.id} question={question} />
          ))}
        </section>
      )}

      <footer className="text-sm text-muted-foreground">
        <Link
          href="/privacy"
          className="underline underline-offset-2 hover:text-foreground"
        >
          Privacy & your data
        </Link>
      </footer>
    </main>
  );
}
