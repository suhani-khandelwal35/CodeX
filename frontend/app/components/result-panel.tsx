"use client";

import type { ReactNode } from "react";

import type { Submission } from "../practice/api";
import { formatDateTime, formatPercent } from "../lib/format";
import { IconArrowRight, IconCheck, IconX } from "./icons";
import {
  Badge,
  Button,
  CodeBlock,
  Eyebrow,
  Meter,
  cx,
  difficultyTone,
  masteryTone,
  verdictTone,
} from "./ui";

export interface VerdictCopy {
  title: string;
  summary: string;
}

/** Maps Judge0-derived statuses to concise, honest copy. The status itself is never altered. */
export function describeVerdict(status: string, isCorrect: boolean, failedTest?: number | null): VerdictCopy {
  if (isCorrect) {
    return {
      title: "Accepted",
      summary: "Every visible and hidden test case produced the expected output.",
    };
  }
  const where = failedTest ? ` on test case ${failedTest}` : "";
  const key = status.toLowerCase();
  if (key.includes("wrong answer")) {
    return {
      title: status,
      summary: `The program ran but its output differed from the expected output${where}.`,
    };
  }
  if (key.includes("compilation")) {
    return {
      title: status,
      summary: "The judge could not compile the program. Fix the errors below and resubmit.",
    };
  }
  if (key.includes("runtime")) {
    return {
      title: status,
      summary: `The program crashed while running${where}. The judge's diagnostic is shown below.`,
    };
  }
  if (key.includes("time limit")) {
    return {
      title: status,
      summary: `The program exceeded the judge's time limit${where}. Look for a more efficient approach.`,
    };
  }
  return { title: status, summary: `The judge rejected this submission${where}.` };
}

export const MISTAKE_CATEGORY_LABELS: Record<string, string> = {
  logic_error: "Logic error",
  syntax_error: "Syntax error",
  edge_case: "Edge case",
  inefficient_solution: "Inefficient solution",
  unknown: "Uncategorised",
};

export function VerdictHeader({
  status,
  isCorrect,
  failedTest,
  submittedAt,
  trailing,
}: {
  status: string;
  isCorrect: boolean;
  failedTest?: number | null;
  submittedAt?: string | null;
  trailing?: ReactNode;
}) {
  const tone = verdictTone(status, isCorrect);
  const copy = describeVerdict(status, isCorrect, failedTest);
  return (
    <div
      className={cx(
        "flex items-start gap-3 rounded-xl border p-4",
        tone === "success"
          ? "border-success/30 bg-success/[0.07]"
          : tone === "warning"
            ? "border-warning/30 bg-warning/[0.07]"
            : "border-danger/30 bg-danger/[0.07]",
      )}
    >
      <span
        className={cx(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          tone === "success"
            ? "bg-success/20 text-success"
            : tone === "warning"
              ? "bg-warning/20 text-warning"
              : "bg-danger/20 text-danger",
        )}
      >
        {isCorrect ? <IconCheck size={18} /> : <IconX size={18} />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="text-base font-semibold tracking-tight text-ink" role="status">
            {copy.title}
          </p>
          <Badge tone="neutral">Verified by Judge0</Badge>
          {trailing}
        </div>
        <p className="mt-1 text-[13px] leading-5 text-muted">{copy.summary}</p>
        {submittedAt && <p className="mt-1 text-[12px] text-faint">{formatDateTime(submittedAt)}</p>}
      </div>
    </div>
  );
}

export function FeedbackBlock({
  feedback,
}: {
  feedback: NonNullable<NonNullable<Submission["evaluation_details"]>["feedback"]>;
}) {
  // Only a successful provider response is labelled AI; "ai" is the label
  // older saved submissions used. Anything else is the rule-based fallback.
  const isAi = feedback.provider === "ai_generated" || feedback.provider === "ai";
  return (
    <div className="rounded-xl border border-line-soft bg-surface-raised/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Eyebrow>{isAi ? "AI-generated feedback" : "Rule-based feedback"}</Eyebrow>
        <Badge tone={isAi ? "accent" : "neutral"}>{isAi ? "Advisory" : "Fallback"}</Badge>
      </div>
      <p className="mt-3 text-sm font-medium leading-6 text-ink">{feedback.explanation}</p>
      <dl className="mt-3 space-y-2 text-[13px] leading-5">
        <div>
          <dt className="font-medium text-muted">Hint</dt>
          <dd className="text-ink">{feedback.hint}</dd>
        </div>
        <div>
          <dt className="font-medium text-muted">Suggested correction</dt>
          <dd className="text-ink">{feedback.correction}</dd>
        </div>
      </dl>
      {!isAi && feedback.fallback_reason && (
        <p className="mt-3 text-[12px] leading-5 text-muted">
          AI feedback was unavailable: {feedback.fallback_reason}
        </p>
      )}
      <p className="mt-3 text-[12px] leading-5 text-faint">
        This explanation does not decide the verdict. Only the Judge0 result above does.
      </p>
    </div>
  );
}

export function ResultPanel({
  submission,
  patternName,
  onPracticeRecommended,
}: {
  submission: Submission;
  patternName?: string;
  onPracticeRecommended?: (problemId: number) => void;
}) {
  const details = submission.evaluation_details;
  const mastery = submission.mastery;
  const showOutput =
    !submission.is_correct && details?.actual_output !== undefined && details?.actual_output !== null;

  return (
    <div className="space-y-4">
      <VerdictHeader
        status={submission.status}
        isCorrect={submission.is_correct}
        failedTest={details?.failed_test}
        submittedAt={submission.submitted_at}
        trailing={
          submission.mistake ? (
            <Badge tone="warning">
              {MISTAKE_CATEGORY_LABELS[submission.mistake.category] ?? submission.mistake.category}
            </Badge>
          ) : null
        }
      />

      {(details?.error || showOutput) && (
        <div className="grid gap-3 md:grid-cols-2">
          {details?.error && (
            <div className="min-w-0">
              <Eyebrow className="mb-1.5">Judge diagnostic</Eyebrow>
              <CodeBlock>{details.error}</CodeBlock>
            </div>
          )}
          {showOutput && (
            <div className="min-w-0">
              <Eyebrow className="mb-1.5">Your output</Eyebrow>
              <CodeBlock>{details?.actual_output || "(empty)"}</CodeBlock>
            </div>
          )}
        </div>
      )}

      {details?.feedback && <FeedbackBlock feedback={details.feedback} />}

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-line-soft bg-surface-raised/60 p-4">
          <Eyebrow>Pattern mastery</Eyebrow>
          {mastery ? (
            <>
              <div className="mt-2 flex items-baseline justify-between gap-3">
                <p className="truncate text-sm font-medium text-ink">{patternName ?? "Pattern"}</p>
                <p className="text-xl font-semibold tracking-tight text-ink">
                  {formatPercent(mastery.mastery_score)}
                </p>
              </div>
              <Meter
                className="mt-2"
                value={mastery.mastery_score}
                tone={masteryTone(mastery.mastery_score)}
                label={`${patternName ?? "Pattern"} mastery`}
              />
              {typeof mastery.total_attempts === "number" && (
                <p className="mt-2 text-[12px] text-muted">
                  {mastery.correct_attempts ?? 0} of {mastery.total_attempts} attempts correct
                  {typeof mastery.consecutive_correct === "number" &&
                    ` · ${mastery.consecutive_correct} in a row`}
                </p>
              )}
            </>
          ) : (
            <p className="mt-2 text-[13px] text-muted">
              Mastery is not available for this pattern yet.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-line-soft bg-surface-raised/60 p-4">
          <Eyebrow>Recommended next</Eyebrow>
          {submission.recommendation ? (
            <>
              <p className="mt-2 text-sm font-medium text-ink">{submission.recommendation.title}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <Badge tone={difficultyTone(submission.recommendation.difficulty)}>
                  {submission.recommendation.difficulty}
                </Badge>
                <Badge>{submission.recommendation.pattern}</Badge>
              </div>
              <p className="mt-2 line-clamp-3 text-[12.5px] leading-5 text-muted">
                {submission.recommendation.reason}
              </p>
              {onPracticeRecommended && (
                <Button
                  size="sm"
                  className="mt-3"
                  onClick={() => onPracticeRecommended(submission.recommendation!.problem_id)}
                >
                  Open problem
                  <IconArrowRight size={14} />
                </Button>
              )}
            </>
          ) : (
            <p className="mt-2 text-[13px] text-muted">No recommendation was returned.</p>
          )}
        </div>
      </div>
    </div>
  );
}
