import { NO_ANSWER_MATCHED_MESSAGE } from "@/lib/scoring";
import type { QuestionView } from "@/lib/quiz/getQuizData";

export function QuestionAwaitingResult({
  question,
}: {
  question: QuestionView;
}) {
  const userAnswer = question.options.find(
    (o) => o.id === question.userAnswerOptionId
  );

  return (
    <div className="card flex flex-col gap-2 border-l-4 border-l-info">
      <p className="font-medium">
        {question.prizeName ? `${question.prizeName}: ` : ""}
        {question.text}
      </p>
      <p className="text-sm text-muted-foreground">
        Your answer: {userAnswer ? userAnswer.label : "— (no answer submitted)"}
      </p>
      <p className="text-sm text-muted-foreground">
        Voting closed. Waiting for the result.
      </p>
    </div>
  );
}

export function QuestionGraded({ question }: { question: QuestionView }) {
  const userAnswer = question.options.find(
    (o) => o.id === question.userAnswerOptionId
  );
  const correctAnswer = question.options.find(
    (o) => o.id === question.correctAnswerOptionId
  );

  return (
    <div className="card flex flex-col gap-2 border-l-4 border-l-accent">
      <p className="font-medium">
        {question.prizeName ? `${question.prizeName}: ` : ""}
        {question.text}
      </p>
      <p className="text-sm text-muted-foreground">
        Correct answer:{" "}
        {question.noneMatched
          ? NO_ANSWER_MATCHED_MESSAGE
          : (correctAnswer?.label ?? "—")}
      </p>
      <p className="text-sm text-muted-foreground">
        Your answer: {userAnswer ? userAnswer.label : "— (no answer submitted)"}
      </p>
      <p className="text-sm font-medium text-accent-tint-foreground">
        Points earned: {question.pointsEarned ?? 0}
      </p>
    </div>
  );
}
