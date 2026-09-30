import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { DeleteAccountForm } from "@/components/auth/DeleteAccountForm";

export const metadata: Metadata = { title: "Privacy & your data — Nobel Quiz" };

export default async function PrivacyPage() {
  const user = await getCurrentUser();

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-16 outline-none"
    >
      <h1 className="text-2xl font-semibold">Privacy & your data</h1>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">What we store</h2>
        <p>
          Your email address, a hashed (never plain-text) version of your
          password, the answers you submit each round, and the points/results
          tied to those answers.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Why we store it</h2>
        <ul className="list-disc pl-5">
          <li>
            <strong>Email</strong> — to let you log in, to verify you own the
            address, and to send you a password-reset link if you ask for one.
            It is never shown to other players.
          </li>
          <li>
            <strong>Password (hashed)</strong> — to check it&apos;s you at
            login. We never store or see your actual password, only a
            one-way hash of it.
          </li>
          <li>
            <strong>Answers</strong> — to score your picks once each
            prize&apos;s result is announced.
          </li>
          <li>
            <strong>Points/results</strong> — to show you your own score and
            the leaderboard. Other players only ever see your display name
            and points, never your email address.
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">How long we keep it</h2>
        <p>
          For as long as your account exists. This quiz runs every year, so
          keeping your account lets you play again next year without signing
          up again — there is no automatic expiry. You can delete your
          account and everything tied to it at any time, and it happens
          immediately (see below).
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Deleting your account</h2>
        <p>
          Deleting your account removes your account and every answer,
          submission, and result tied to it outright — nothing is kept or
          anonymized.
        </p>
        {user ? (
          <DeleteAccountForm />
        ) : (
          <p className="text-sm text-muted-foreground">
            <Link
              href="/login"
              className="text-primary-hover underline underline-offset-2"
            >
              Log in
            </Link>{" "}
            to delete your account.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Playing as a guest</h2>
        <p>
          A guest entry stores only the name you chose and your answers, plus a
          random secret that makes up your private link. No email or password.
          Your name and points appear on the leaderboard like anyone
          else&apos;s. It is kept until the quiz is reset, and you can delete it
          at any time with the &ldquo;Delete my entry&rdquo; button on your
          private page; that removes the name and every answer immediately.
        </p>
      </section>
    </main>
  );
}
