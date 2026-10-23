"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  apiRequest,
  type Mistake,
  type Pattern,
  type Problem,
  type Submission,
} from "../practice/api";
import { HighlightedCode } from "../components/code-editor";
import { useLearner } from "../components/learner-context";
import { IconAlert, IconArrowRight, IconUser } from "../components/icons";
import {
  FeedbackBlock,
  MISTAKE_CATEGORY_LABELS,
  VerdictHeader,
} from "../components/result-panel";
import {
  Badge,
  Button,
  CodeBlock,
  EmptyState,
  ErrorState,
  Eyebrow,
  LinkButton,
  LoadingPanel,
  Panel,
  cx,
  difficultyTone,
  verdictTone,
} from "../components/ui";
import { storePracticePrefill } from "../lib/storage";
import { formatRelative, languageLabel, pluralize } from "../lib/format";

interface FailedAttempt {
  submission: Submission;
  problem: Problem | undefined;
  pattern: Pattern | undefined;
  mistake: Mistake | undefined;
}

export default function MistakesPage() {
  const router = useRouter();
  const learner = useLearner();
  const { learnerId, hydrated } = learner;

  const [attempts, setAttempts] = useState<FailedAttempt[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [reloadVersion, setReloadVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!learnerId) {
        setAttempts(null);
        setError("");
        return;
      }
      setLoading(true);
      setError("");
      try {
        const query = `?user_id=${encodeURIComponent(learnerId)}`;
        const [submissions, problems, patterns, mistakesResult] = await Promise.all([
          apiRequest<Submission[]>(`/submissions/${query}`),
          apiRequest<Problem[]>("/problems/"),
          apiRequest<Pattern[]>("/patterns/"),
          apiRequest<Mistake[]>(`/mistakes/${query}`).catch(() => [] as Mistake[]),
        ]);
        if (cancelled) return;
        const problemById = new Map(problems.map((p) => [p.id, p]));
        const patternById = new Map(patterns.map((p) => [p.id, p]));
        const mistakeBySubmission = new Map(mistakesResult.map((m) => [m.submission_id, m]));
        const failed = submissions
          .filter((submission) => !submission.is_correct)
          .sort((a, b) => {
            const at = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
            const bt = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
            return bt - at || b.id - a.id;
          })
          .map((submission) => {
            const problem = problemById.get(submission.problem_id);
            return {
              submission,
              problem,
              pattern: problem ? patternById.get(problem.pattern_id) : undefined,
              mistake: mistakeBySubmission.get(submission.id),
            };
          });
        setAttempts(failed);
        setSelectedId((current) =>
          current && failed.some((item) => item.submission.id === current)
            ? current
            : (failed[0]?.submission.id ?? null),
        );
      } catch (requestError) {
        if (!cancelled) {
          setAttempts(null);
          setError(requestError instanceof Error ? requestError.message : "Could not load submissions.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [learnerId, reloadVersion]);

  const statuses = useMemo(() => {
    const set = new Set<string>();
    for (const item of attempts ?? []) set.add(item.submission.status);
    return [...set];
  }, [attempts]);

  const visible = useMemo(
    () =>
      (attempts ?? []).filter(
        (item) => statusFilter === "all" || item.submission.status === statusFilter,
      ),
    [attempts, statusFilter],
  );

  const selected =
    visible.find((item) => item.submission.id === selectedId) ?? visible[0] ?? null;

  function revisit(item: FailedAttempt, withCode: boolean) {
    if (withCode && item.submission.code) {
      storePracticePrefill({
        problemId: item.submission.problem_id,
        language: item.submission.language,
        code: item.submission.code,
      });
    }
    router.push(`/practice?problem_id=${item.submission.problem_id}`);
  }

  if (!hydrated) return <LoadingPanel label="Restoring learner" />;

  if (!learnerId) {
    return (
      <div className="mx-auto max-w-2xl pt-6">
        <EmptyState
          icon={<IconUser size={22} />}
          title="Choose a learner to review mistakes"
          body="Failed attempts are read from the submissions and mistake records saved for one learner."
          action={
            <Button variant="primary" onClick={learner.openPanel}>
              Choose or create a learner
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight text-ink">Mistake review</h1>
          <p className="mt-1 text-[13.5px] text-muted">
            {loading
              ? "Loading failed attempts…"
              : attempts
                ? `${pluralize(attempts.length, "failed attempt")} with the judge output and feedback that explain them.`
                : "Failed attempts with the judge output and feedback that explain them."}
          </p>
        </div>
        <Button size="sm" onClick={() => setReloadVersion((v) => v + 1)} disabled={loading}>
          Refresh
        </Button>
      </header>

      {loading && !attempts ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <LoadingPanel lines={6} label="Loading attempts" />
          <LoadingPanel lines={8} label="Loading attempts" />
        </div>
      ) : error ? (
        <ErrorState
          title="Submissions could not be loaded"
          message={error}
          hint="Check that the backend is running and the learner ID exists."
          action={<Button size="sm" onClick={() => setReloadVersion((v) => v + 1)}>Try again</Button>}
        />
      ) : attempts && attempts.length === 0 ? (
        <EmptyState
          icon={<IconAlert size={22} />}
          title="No failed attempts to review"
          body="Every saved submission for this learner was accepted, or nothing has been submitted yet."
          action={<LinkButton href="/practice">Go to practice</LinkButton>}
        />
      ) : attempts ? (
        <div className={cx("grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]", loading && "opacity-60")}>
          <Panel className="p-0 lg:sticky lg:top-20">
            <div className="flex items-center gap-2 border-b border-line-soft px-4 py-3">
              <label className="flex flex-1 items-center gap-2 text-[12.5px] text-muted">
                <span className="shrink-0">Verdict</span>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="field h-8 !py-0 text-[12.5px]"
                >
                  <option value="all">All ({attempts.length})</option>
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {status} ({attempts.filter((a) => a.submission.status === status).length})
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <ul className="scroll-quiet max-h-[70vh] divide-y divide-line-soft overflow-y-auto" role="listbox" aria-label="Failed attempts">
              {visible.length === 0 ? (
                <li className="px-4 py-6 text-[13px] text-muted">No attempts match this filter.</li>
              ) : (
                visible.map((item) => {
                  const active = selected?.submission.id === item.submission.id;
                  return (
                    <li key={item.submission.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={active}
                        onClick={() => setSelectedId(item.submission.id)}
                        className={cx(
                          "focus-ring relative flex w-full flex-col gap-1.5 px-4 py-3 text-left transition-colors",
                          active ? "bg-accent/[0.08]" : "hover:bg-white/[0.03]",
                        )}
                      >
                        {active && (
                          <span aria-hidden className="absolute left-0 top-3 bottom-3 w-0.5 rounded-r bg-accent" />
                        )}
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-[13.5px] font-medium text-ink">
                            {item.problem?.title ?? `Problem ${item.submission.problem_id}`}
                          </span>
                          <span className="shrink-0 text-[11.5px] tabular-nums text-faint">
                            {formatRelative(item.submission.submitted_at)}
                          </span>
                        </span>
                        <span className="flex flex-wrap items-center gap-1.5">
                          <Badge tone={verdictTone(item.submission.status, false)} dot>
                            {item.submission.status}
                          </Badge>
                          {item.mistake && (
                            <Badge>{MISTAKE_CATEGORY_LABELS[item.mistake.category] ?? item.mistake.category}</Badge>
                          )}
                          <span className="text-[11.5px] text-faint">
                            {item.pattern?.name ?? "Pattern"} · {languageLabel(item.submission.language)}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </Panel>

          {selected ? (
            <Panel as="article" className="space-y-4 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Eyebrow>Submission #{selected.submission.id}</Eyebrow>
                  <h2 className="mt-1 text-[19px] font-semibold leading-snug tracking-tight text-ink">
                    {selected.problem?.title ?? `Problem ${selected.submission.problem_id}`}
                  </h2>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selected.problem && (
                      <Badge tone={difficultyTone(selected.problem.difficulty)}>{selected.problem.difficulty}</Badge>
                    )}
                    {selected.pattern && <Badge tone="accent">{selected.pattern.name}</Badge>}
                    <Badge>{languageLabel(selected.submission.language)}</Badge>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => revisit(selected, false)}>
                    Start fresh
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={!selected.submission.code}
                    onClick={() => revisit(selected, true)}
                  >
                    Revisit with this code
                    <IconArrowRight size={14} />
                  </Button>
                </div>
              </div>

              <VerdictHeader
                status={selected.submission.status}
                isCorrect={false}
                failedTest={selected.submission.evaluation_details?.failed_test}
                submittedAt={selected.submission.submitted_at}
                trailing={
                  selected.mistake ? (
                    <Badge tone="warning">
                      {MISTAKE_CATEGORY_LABELS[selected.mistake.category] ?? selected.mistake.category}
                    </Badge>
                  ) : null
                }
              />

              {(selected.submission.evaluation_details?.error ||
                (selected.submission.evaluation_details?.actual_output !== undefined &&
                  selected.submission.evaluation_details?.actual_output !== null)) && (
                <div className="grid gap-3 md:grid-cols-2">
                  {selected.submission.evaluation_details?.error && (
                    <div className="min-w-0">
                      <Eyebrow className="mb-1.5">Judge diagnostic</Eyebrow>
                      <CodeBlock>{selected.submission.evaluation_details.error}</CodeBlock>
                    </div>
                  )}
                  {selected.submission.evaluation_details?.actual_output !== undefined &&
                    selected.submission.evaluation_details?.actual_output !== null && (
                      <div className="min-w-0">
                        <Eyebrow className="mb-1.5">Your output</Eyebrow>
                        <CodeBlock>{selected.submission.evaluation_details.actual_output || "(empty)"}</CodeBlock>
                      </div>
                    )}
                </div>
              )}

              {selected.submission.evaluation_details?.feedback ? (
                <FeedbackBlock feedback={selected.submission.evaluation_details.feedback} />
              ) : selected.mistake?.explanation ? (
                <div className="rounded-xl border border-line-soft bg-surface-raised/60 p-4">
                  <Eyebrow>Recorded explanation</Eyebrow>
                  <p className="mt-2 text-sm leading-6 text-ink">{selected.mistake.explanation}</p>
                  {selected.mistake.correction && (
                    <p className="mt-2 text-[13px] leading-5 text-muted">
                      <span className="font-medium text-ink">Suggested correction: </span>
                      {selected.mistake.correction}
                    </p>
                  )}
                </div>
              ) : null}

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <Eyebrow>Submitted code</Eyebrow>
                  {selected.submission.code && (
                    <span className="text-[11.5px] tabular-nums text-faint">
                      {pluralize(selected.submission.code.split("\n").length, "line")}
                    </span>
                  )}
                </div>
                {selected.submission.code ? (
                  <HighlightedCode code={selected.submission.code} language={selected.submission.language} />
                ) : (
                  <p className="text-[13px] text-muted">The source code was not stored for this submission.</p>
                )}
              </div>

              {selected.problem?.sample_cases.length ? (
                <div className="border-t border-line-soft pt-4">
                  <Eyebrow className="mb-2">Sample case to re-check</Eyebrow>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="min-w-0">
                      <p className="mb-1 text-[11.5px] text-faint">Input</p>
                      <CodeBlock maxHeight="8rem">{selected.problem.sample_cases[0].input}</CodeBlock>
                    </div>
                    <div className="min-w-0">
                      <p className="mb-1 text-[11.5px] text-faint">Expected output</p>
                      <CodeBlock maxHeight="8rem">{selected.problem.sample_cases[0].expected_output}</CodeBlock>
                    </div>
                  </div>
                </div>
              ) : null}
            </Panel>
          ) : (
            <EmptyState compact title="Select an attempt" body="Pick a failed attempt from the list to see its details." />
          )}
        </div>
      ) : null}
    </div>
  );
}
