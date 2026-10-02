import { cookies } from "next/headers";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { getCurrentGuest } from "@/lib/guest/session";
import { logout } from "@/lib/auth/actions";
import { getQuizPageData, isEndOfWeek } from "@/lib/quiz/getQuizData";
import { computeLeaderboard } from "@/lib/quiz/leaderboard";
import { Leaderboard } from "@/components/quiz/Leaderboard";
import { FullLeaderboard } from "@/components/quiz/FullLeaderboard";
import { NobelMedal } from "@/components/landing/NobelMedal";
import { PrizeWeek } from "@/components/landing/PrizeWeek";
import { SampleQuestion } from "@/components/landing/SampleQuestion";
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
    const [verifiedUserCount, guestCount, guest] = await Promise.all([
      prisma.user.count({ where: { emailVerified: true } }),
      prisma.guestPlayer.count(),
      getCurrentGuest(),
    ]);
    const userCount = verifiedUserCount + guestCount;

    return (
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-4 py-10 outline-none"
      >
        <section className="flex flex-col items-center gap-4 rounded-2xl bg-navy px-6 py-10 text-center text-navy-foreground">
          <NobelMedal className="h-36 w-36" />
          <h1 className="text-4xl font-semibold !text-gold">Nobel Quiz</h1>
          <p className="max-w-xl text-lg">
            Guess how Nobel prize week 2026 will turn out. Each prize day has a
            couple of questions about that prize, and there are a few whole-week
            questions too. Pick one answer per question.
          </p>
          <p className="max-w-xl">
            Bold guesses pay best: the rarer the outcome, the more points you
            bank. Every point lands on the live leaderboard, so think you know
            your Nobels better than your friends and colleagues? Prove it, and
            claim the top spot.
          </p>
          <p className="font-medium">
            Now {userCount} guessing {userCount === 1 ? "user" : "users"} and
            counting
          </p>
          {guest && (
            <p className="rounded-md bg-white/10 px-4 py-2">
              You&apos;re playing as a guest ({guest.displayName}).{" "}
              <Link
                href={`/guest/${guest.token}`}
                className="font-semibold underline underline-offset-2"
              >
                See your entry
              </Link>
            </p>
          )}
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/signup"
              className="rounded-md bg-gold px-5 py-2 font-semibold text-navy hover:brightness-110"
            >
              Sign up
            </Link>
            <Link
              href="/login"
              className="rounded-md border border-navy-foreground px-5 py-2 font-medium hover:bg-white/10"
            >
              Log in
            </Link>
          </div>
          {!guest && (
            <p className="text-sm">
              Not ready to register?{" "}
              <Link
                href="/play"
                className="font-semibold underline underline-offset-2"
              >
                Just play as a guest
              </Link>{" "}
              (answers are final).
            </p>
          )}
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold">Try a question</h2>
          <SampleQuestion
            prizeName="Physics"
            text="How many laureates will share the Physics prize?"
            total={20}
            options={[
              { label: "2 laureates", count: 7 },
              { label: "3 laureates", count: 13 },
            ]}
          />
        </section>

        <PrizeWeek />
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
