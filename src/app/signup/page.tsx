import Link from "next/link";
import { SignupForm } from "@/components/auth/SignupForm";

export default function SignupPage() {
  return (
    <main className="mx-auto flex max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-16">
      <h1 className="text-2xl font-semibold">Create your account</h1>
      <p className="text-sm text-zinc-600">
        Your email address is stored only to let you log in, verify your
        account, and receive password-reset emails — it is never shown to other
        players. You can request deletion of your account and all your data at
        any time. Other players only ever see your display name and points.
      </p>
      <SignupForm />
      <p className="text-sm">
        Already have an account?{" "}
        <Link href="/login" className="underline">
          Log in
        </Link>
      </p>
    </main>
  );
}
