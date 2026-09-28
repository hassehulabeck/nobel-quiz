import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { logout } from "@/lib/auth/actions";

export default async function Home() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <main className="mx-auto flex max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-16 text-center">
        <h1 className="text-3xl font-semibold">Nobel Quiz</h1>
        <p className="text-zinc-600">
          Guess this year&apos;s Nobel prize outcomes.
        </p>
        <div className="flex justify-center gap-4">
          <Link href="/login" className="rounded bg-black px-4 py-2 text-white">
            Log in
          </Link>
          <Link href="/signup" className="rounded border px-4 py-2">
            Sign up
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-1 flex-col gap-6 px-4 py-16">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Welcome, {user.displayName}</h1>
        <form action={logout}>
          <button type="submit" className="rounded border px-3 py-1.5 text-sm">
            Log out
          </button>
        </form>
      </div>
      <p className="text-zinc-600">
        The quiz form, leaderboard, and today&apos;s prize info are coming in
        the next phase of development.
      </p>
    </main>
  );
}
