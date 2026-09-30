"use client";

import { useActionState } from "react";
import { submitGuestEntry, type GuestEntryState } from "@/lib/guest/actions";
import { GUEST_QUESTION_FIELD_PREFIX } from "@/lib/guest/constants";
import type { QuestionView } from "@/lib/quiz/getQuizData";
import { Countdown } from "@/components/quiz/Countdown";

/**
 * One form for every still-open question plus a name. Submitting is final:
 * the server stores the answers once and there is no edit screen.
 */
export function GuestEntryForm({ questions }: { questions: QuestionView[] }) {
  const [state, formAction, pending] = useActionState<
    GuestEntryState,
    FormData
  >(submitGuestEntry, null);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div className="card flex flex-col gap-2">
        <label htmlFor="guest-name" className="font-medium">
          Your name on the leaderboard
        </label>
        <input
          id="guest-name"
          name="displayName"
          required
          minLength={3}
          maxLength={24}
          autoComplete="nickname"
          className="field-input"
        />
        {/* Honeypot: hidden from people, tempting to bots. */}
        <div aria-hidden="true" className="hidden">
          <input name="website" tabIndex={-1} autoComplete="off" />
        </div>
      </div>

      {questions.map((question) => (
        <fieldset key={question.id} className="card flex flex-col gap-2">
          <legend className="font-medium">
            {question.prizeName ? `${question.prizeName}: ` : ""}
            {question.text}
          </legend>
          {question.options.map((option) => (
            <label key={option.id} className="flex items-center gap-2">
              <input
                type="radio"
                name={`${GUEST_QUESTION_FIELD_PREFIX}${question.id}`}
                value={option.id}
                className="h-4 w-4 accent-primary"
              />
              <span>
                {option.label}{" "}
                <span className="text-muted-foreground">
                  ({option.points.toFixed(2)} pts)
                </span>
              </span>
            </label>
          ))}
          <Countdown deadline={question.answerDeadline.toISOString()} />
        </fieldset>
      ))}

      <p className="rounded-md bg-warning-tint px-3 py-2 text-sm text-warning-tint-foreground">
        <strong>Answers are final.</strong> Guest entries can&apos;t be changed
        after you submit. Want to change your mind later? Sign up for an account
        instead.
      </p>

      {state && "error" in state && (
        <p
          role="alert"
          className="rounded-md bg-destructive-tint px-3 py-2 text-sm font-medium text-destructive"
        >
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="btn-primary self-start"
      >
        {pending ? "Submitting..." : "Submit my final answers"}
      </button>
    </form>
  );
}
