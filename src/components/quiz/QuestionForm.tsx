"use client";

import { useActionState } from "react";
import { submitAnswer, type SubmitAnswerState } from "@/lib/quiz/actions";
import type { QuestionView } from "@/lib/quiz/getQuizData";
import { Countdown } from "./Countdown";

export function QuestionForm({ question }: { question: QuestionView }) {
  const [state, formAction, pending] = useActionState<
    SubmitAnswerState,
    FormData
  >(submitAnswer, null);

  return (
    <form action={formAction} className="card flex flex-col gap-3">
      <input type="hidden" name="questionId" value={question.id} />
      <fieldset className="flex flex-col gap-2">
        <legend className="font-medium">
          {question.prizeName ? `${question.prizeName}: ` : ""}
          {question.text}
        </legend>
        {question.options.map((option) => (
          <label key={option.id} className="flex items-center gap-2">
            <input
              type="radio"
              name="answerOptionId"
              value={option.id}
              defaultChecked={option.id === question.userAnswerOptionId}
              required
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
      </fieldset>
      <Countdown deadline={question.answerDeadline.toISOString()} />
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
        className="btn-primary self-start px-3 py-1.5 text-sm"
      >
        {pending
          ? "Saving..."
          : question.userAnswerOptionId
            ? "Update answer"
            : "Submit answer"}
      </button>
    </form>
  );
}
