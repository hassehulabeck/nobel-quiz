import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const metadata: Metadata = { title: "Reset your password — Nobel Quiz" };

export default function ForgotPasswordPage() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto flex max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-16 outline-none"
    >
      <h1 className="text-2xl font-semibold">Reset your password</h1>
      <ForgotPasswordForm />
    </main>
  );
}
