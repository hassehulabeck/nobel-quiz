import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getAdminQuestions } from "@/lib/admin/getAdminData";
import { GradingForm } from "@/components/admin/GradingForm";

export const metadata: Metadata = { title: "Admin — result grading — Nobel Quiz" };

export default async function AdminResultsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (!user.isAdmin) {
    return (
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-2xl flex-1 px-4 py-16 outline-none">
        <p>You don&apos;t have access to this page.</p>
      </main>
    );
  }

  const questions = await getAdminQuestions();
  const needsAttention = questions.filter((q) => !q.result?.approvedAt);
  const approved = questions.filter((q) => q.result?.approvedAt);

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-16 outline-none"
    >
      <h1 className="text-2xl font-semibold">Admin — result grading</h1>

      <section className="flex flex-col gap-6">
        <h2 className="text-xl font-semibold">
          Needs attention ({needsAttention.length})
        </h2>
        {needsAttention.length === 0 && (
          <p className="text-muted-foreground">Nothing waiting on you right now.</p>
        )}
        {needsAttention.map((question) => (
          <GradingForm key={question.id} question={question} />
        ))}
      </section>

      {approved.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">Already approved</h2>
          <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
            {approved.map((question) => (
              <li key={question.id}>
                {question.prizeName ? `${question.prizeName}: ` : ""}
                {question.text} —{" "}
                {question.result?.noneMatched
                  ? "no answer matched (1 pt fallback)"
                  : (question.options.find(
                      (o) => o.id === question.result?.correctAnswerOptionId
                    )?.label ?? "unknown")}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
