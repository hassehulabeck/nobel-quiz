import { cookies } from "next/headers";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { logout } from "@/lib/auth/actions";
import { getQuizPageData, isEndOfWeek } from "@/lib/quiz/getQuizData";
import { computeLeaderboard } from "@/lib/quiz/leaderboard";
import { Leaderboard } from "@/components/quiz/Leaderboard";
import { FullLeaderboard } from "@/components/quiz/FullLeaderboard";
import { PlayerName } from "@/components/quiz/PlayerName";
import { QuestionsByDay } from "@/components/quiz/QuestionsByDay";
import { RulesContent } from "@/components/quiz/RulesContent";
import { RulesPanel } from "@/components/quiz/RulesPanel";
import { RULES_HIDDEN_COOKIE } from "@/lib/quiz/rulesCookie";

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
            <QuestionsByDay questions={questions} />
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

  const [questions, leaderboard, cookieStore] = await Promise.all([
    getQuizPageData(user.id),
    computeLeaderboard(),
    cookies(),
  ]);
  const rulesOpen = cookieStore.get(RULES_HIDDEN_COOKIE)?.value !== "1";

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-16 outline-none"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">
          Welcome, <PlayerName name={user.displayName} />
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/account"
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-warning-tint"
          >
            Change name
          </Link>
          <form action={logout}>
            <button
              type="submit"
              className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-warning-tint"
            >
              Log out
            </button>
          </form>
        </div>
      </header>

      <RulesPanel defaultOpen={rulesOpen}>
        <RulesContent />
      </RulesPanel>

      <Leaderboard entries={leaderboard} currentUserId={user.id} />

      <QuestionsByDay questions={questions} />

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
