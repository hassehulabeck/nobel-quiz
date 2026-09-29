"use client";

import { useActionState } from "react";
import { approveResult, type ApproveResultState } from "@/lib/admin/actions";
import { NONE_MATCHED_SENTINEL } from "@/lib/admin/constants";
import type { AdminQuestionView } from "@/lib/admin/getAdminData";

export function GradingForm({ question }: { question: AdminQuestionView }) {
  const [state, formAction, pending] = useActionState<
    ApproveResultState,
    FormData
  >(approveResult, null);

  const result = question.result;
  const isProposed = result?.status === "PROPOSED";
  const needsManual = !question.gradingKey || !isProposed;

  return (
    <form action={formAction} className="card flex flex-col gap-3">
      <input type="hidden" name="questionId" value={question.id} />
      <div>
        <p className="font-medium">
          {question.prizeName ? `${question.prizeName}: ` : ""}
          {question.text}
        </p>
        <p className="text-sm text-muted-foreground">
          Deadline: {question.answerDeadline.toISOString()}
        </p>
      </div>

      {isProposed && (
        <p className="rounded-md bg-warning-tint px-3 py-2 text-sm text-warning-tint-foreground">
          Scraper proposed an answer — review before approving.
        </p>
      )}
      {needsManual && (
        <p className="rounded-md bg-info-tint px-3 py-2 text-sm text-info-tint-foreground">
          {question.gradingKey
            ? `No proposal yet (${result?.scrapeAttempts ?? 0} scrape attempt(s) so far). Enter the result by hand.`
            : "This question is never auto-graded (citizenship or genre judgement) — enter the result by hand."}
        </p>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">Correct answer</legend>
        {question.options.map((option) => (
          <label key={option.id} className="flex items-center gap-2">
            <input
              type="radio"
              name="answerOptionId"
              value={option.id}
              defaultChecked={
                !result?.noneMatched &&
                option.id === result?.correctAnswerOptionId
              }
              required
              className="h-4 w-4 accent-primary"
            />
            <span>{option.label}</span>
          </label>
        ))}
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="answerOptionId"
            value={NONE_MATCHED_SENTINEL}
            defaultChecked={!!result?.noneMatched}
            required
            className="h-4 w-4 accent-primary"
          />
          <span>
            None of these matched (per 2.6: every user gets 1 point)
          </span>
        </label>
      </fieldset>

      {result?.rawScrapedData !== undefined && result?.rawScrapedData !== null ? (
        <details className="text-xs text-muted-foreground">
          <summary>Raw scraped data</summary>
          <pre className="overflow-x-auto whitespace-pre-wrap">
            {JSON.stringify(result.rawScrapedData, null, 2)}
          </pre>
        </details>
      ) : null}

      {state && "error" in state && (
        <p
          role="alert"
          className="rounded-md bg-destructive-tint px-3 py-2 text-sm font-medium text-destructive"
        >
          {state.error}
        </p>
      )}
      {state && "success" in state && (
        <p
          role="status"
          className="rounded-md bg-accent-tint px-3 py-2 text-sm font-medium text-accent-tint-foreground"
        >
          Approved.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="btn-primary self-start px-3 py-1.5 text-sm"
      >
        {pending ? "Approving..." : "Approve"}
      </button>
    </form>
  );
}
