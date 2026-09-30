import { formatStockholmDay, isSameStockholmDay } from "@/lib/timezone";
import type { QuestionView } from "@/lib/quiz/getQuizData";
import { QuestionForm } from "./QuestionForm";
import {
  QuestionAwaitingResult,
  QuestionGraded,
  QuestionLocked,
} from "./QuestionReadOnly";

function QuestionCard({
  question,
  locked,
}: {
  question: QuestionView;
  locked: boolean;
}) {
  if (question.status === "open") {
    return locked ? (
      <QuestionLocked question={question} />
    ) : (
      <QuestionForm question={question} />
    );
  }
  if (question.status === "awaiting_result") {
    return <QuestionAwaitingResult question={question} />;
  }
  return <QuestionGraded question={question} />;
}

/**
 * All questions in announcement order: one block per prize day (thin rule
 * between days), then a heavier rule and the whole-week questions. Expects
 * `questions` already sorted by getQuizPageData.
 */
export function QuestionsByDay({
  questions,
  locked = false,
}: {
  questions: QuestionView[];
  /** Guests: open questions show their locked answer instead of an edit form. */
  locked?: boolean;
}) {
  const days: {
    label: string;
    prizeName: string;
    announcementAt: Date;
    items: QuestionView[];
  }[] = [];
  for (const question of questions) {
    if (question.scope !== "PRIZE_SPECIFIC" || !question.announcementAt)
      continue;
    const last = days[days.length - 1];
    if (
      last &&
      last.prizeName === question.prizeName &&
      isSameStockholmDay(last.announcementAt, question.announcementAt)
    ) {
      last.items.push(question);
    } else {
      days.push({
        label: formatStockholmDay(question.announcementAt),
        prizeName: question.prizeName ?? "",
        announcementAt: question.announcementAt,
        items: [question],
      });
    }
  }
  const wholeWeek = questions.filter((q) => q.scope === "WHOLE_WEEK");

  return (
    <div className="flex flex-col gap-8">
      {days.map((day) => (
        <section
          key={`${day.label}-${day.prizeName}`}
          className="flex flex-col gap-4 border-t border-border pt-6 first:border-t-0 first:pt-0"
        >
          <h2 className="text-xl font-semibold">
            {day.label} <span className="text-muted-foreground">·</span>{" "}
            {day.prizeName}
          </h2>
          {day.items.map((question) => (
            <QuestionCard
              key={question.id}
              question={question}
              locked={locked}
            />
          ))}
        </section>
      ))}

      {wholeWeek.length > 0 && (
        <section
          className={`flex flex-col gap-4 ${
            days.length > 0 ? "border-t-4 border-border pt-8" : ""
          }`}
        >
          <h2 className="text-xl font-semibold">Whole-week questions</h2>
          <p className="text-sm text-muted-foreground">
            These are about the week&apos;s prizes as a whole rather than one
            announcement.
          </p>
          {wholeWeek.map((question) => (
            <QuestionCard
              key={question.id}
              question={question}
              locked={locked}
            />
          ))}
        </section>
      )}
    </div>
  );
}
