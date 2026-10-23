"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  apiRequest,
  type LearnerProgress,
  type PatternProgress,
  type Recommendation,
  type RevisionTask,
  type Submission,
} from "../practice/api";
import { learnerDisplayName, useLearner } from "../components/learner-context";
import {
  IconArrowRight,
  IconCheck,
  IconFlame,
  IconTarget,
  IconUser,
} from "../components/icons";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Eyebrow,
  LinkButton,
  LoadingPanel,
  Meter,
  Panel,
  PanelHeader,
  StatTile,
  cx,
  difficultyTone,
  masteryTone,
  verdictTone,
} from "../components/ui";
import {
  dayKey,
  formatDate,
  formatPercent,
  formatRelative,
  languageLabel,
  pluralize,
} from "../lib/format";

const NO_RECOMMENDATION_MESSAGE = "No problems with usable test cases are available";
const ACTIVITY_DAYS = 14;

interface DayBucket {
  key: string;
  label: string;
  accepted: number;
  rejected: number;
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Working late";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** Consecutive calendar days with at least one submission, ending today or yesterday. */
function practiceDayStreak(submissions: Submission[]): number {
  const days = new Set<string>();
  for (const submission of submissions) {
    if (!submission.submitted_at) continue;
    const date = new Date(submission.submitted_at);
    if (!Number.isNaN(date.getTime())) days.add(dayKey(date));
  }
  if (days.size === 0) return 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  if (!days.has(dayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(dayKey(cursor))) return 0;
  }
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Correct submissions in a row, counting back from the most recent. */
function currentCorrectRun(sorted: Submission[]): number {
  let run = 0;
  for (const submission of sorted) {
    if (!submission.is_correct) break;
    run += 1;
  }
  return run;
}

function bucketActivity(submissions: Submission[]): DayBucket[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const buckets: DayBucket[] = [];
  const index = new Map<string, DayBucket>();
  for (let offset = ACTIVITY_DAYS - 1; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    const key = dayKey(date);
    const bucket: DayBucket = {
      key,
      label: new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(date),
      accepted: 0,
      rejected: 0,
    };
    buckets.push(bucket);
    index.set(key, bucket);
  }
  for (const submission of submissions) {
    if (!submission.submitted_at) continue;
    const date = new Date(submission.submitted_at);
    if (Number.isNaN(date.getTime())) continue;
    const bucket = index.get(dayKey(date));
    if (!bucket) continue;
    if (submission.is_correct) bucket.accepted += 1;
    else bucket.rejected += 1;
  }
  return buckets;
}

function ActivityChart({ buckets }: { buckets: DayBucket[] }) {
  const max = Math.max(1, ...buckets.map((b) => b.accepted + b.rejected));
  const total = buckets.reduce((sum, b) => sum + b.accepted + b.rejected, 0);
  const plotHeight = 112;

  return (
    <div>
      <div className="flex items-center gap-4 text-[12px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-accent" aria-hidden />
          Accepted
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-faint" aria-hidden />
          Not accepted
        </span>
        <span className="ml-auto text-faint">{pluralize(total, "submission")} in 14 days</span>
      </div>
      <div className="mt-3 grid grid-cols-[repeat(14,minmax(0,1fr))] items-end gap-1.5" style={{ height: plotHeight }}>
        {buckets.map((bucket) => {
          const count = bucket.accepted + bucket.rejected;
          const acceptedPx = (bucket.accepted / max) * plotHeight;
          const rejectedPx = (bucket.rejected / max) * plotHeight;
          const tooltip = `${bucket.label}: ${bucket.accepted} accepted, ${bucket.rejected} not accepted`;
          return (
            <div key={bucket.key} className="group relative flex h-full items-end justify-center" title={tooltip}>
              <div className="flex w-full max-w-[22px] flex-col-reverse gap-0.5">
                {count === 0 ? (
                  <div className="h-0.5 rounded-sm bg-line-soft" aria-hidden />
                ) : (
                  <>
                    {bucket.accepted > 0 && (
                      <div
                        className={cx("bg-accent", bucket.rejected === 0 && "rounded-t")}
                        style={{ height: Math.max(3, acceptedPx) }}
                      />
                    )}
                    {bucket.rejected > 0 && (
                      <div className="rounded-t bg-faint" style={{ height: Math.max(3, rejectedPx) }} />
                    )}
                  </>
                )}
              </div>
              <span className="sr-only">{tooltip}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-faint">
        <span>{buckets[0]?.label}</span>
        <span>{buckets[Math.floor(buckets.length / 2)]?.label}</span>
        <span>Today</span>
      </div>
    </div>
  );
}

function VerdictBreakdown({ submissions }: { submissions: Submission[] }) {
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const submission of submissions) {
      map.set(submission.status, (map.get(submission.status) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [submissions]);
  const total = submissions.length || 1;

  if (counts.length === 0) {
    return <p className="text-[13px] text-muted">No verdicts recorded yet.</p>;
  }

  return (
    <ul className="space-y-3">
      {counts.map(([status, count]) => (
        <li key={status}>
          <div className="flex items-center justify-between gap-3 text-[13px]">
            <span className="flex items-center gap-2 text-ink">
              <span
                className={cx(
                  "h-2 w-2 rounded-full",
                  status === "Accepted" ? "bg-success" : status === "Compilation Error" ? "bg-warning" : "bg-danger",
                )}
                aria-hidden
              />
              {status}
            </span>
            <span className="tabular-nums text-muted">
              {count} · {Math.round((count / total) * 100)}%
            </span>
          </div>
          <Meter
            className="mt-1.5"
            value={(count / total) * 100}
            tone={status === "Accepted" ? "success" : status === "Compilation Error" ? "warning" : "danger"}
            label={`${status} share`}
          />
        </li>
      ))}
    </ul>
  );
}

function PatternRow({
  pattern,
  label,
}: {
  pattern: PatternProgress;
  label?: "Focus" | "Strong";
}) {
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Link
              href={`/practice?pattern_id=${pattern.pattern_id}`}
              className="focus-ring truncate rounded text-[13.5px] font-medium text-ink hover:text-accent-2"
            >
              {pattern.pattern_name}
            </Link>
            {label && (
              <Badge tone={label === "Focus" ? "danger" : "success"}>{label}</Badge>
            )}
          </div>
          <p className="mt-0.5 text-[12px] text-faint">
            {pluralize(pattern.total_attempts, "attempt")} · {pattern.accuracy_percentage}% accuracy
            {pattern.consecutive_correct > 0 && ` · ${pattern.consecutive_correct} in a row`}
          </p>
        </div>
        <span className="text-[15px] font-semibold tabular-nums text-ink">
          {formatPercent(pattern.mastery_score)}
        </span>
      </div>
      <Meter
        className="mt-2"
        value={pattern.mastery_score}
        tone={masteryTone(pattern.mastery_score)}
        label={`${pattern.pattern_name} mastery`}
      />
    </li>
  );
}

export default function DashboardPage() {
  const learner = useLearner();
  const { learnerId, hydrated } = learner;

  const [progress, setProgress] = useState<LearnerProgress | null>(null);
  const [submissions, setSubmissions] = useState<Submission[] | null>(null);
  const [revisions, setRevisions] = useState<RevisionTask[]>([]);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    progress?: string;
    submissions?: string;
    revisions?: string;
    recommendation?: string;
  }>({});
  const [reloadVersion, setReloadVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!learnerId) {
        setProgress(null);
        setSubmissions(null);
        setRevisions([]);
        setRecommendation(null);
        setErrors({});
        return;
      }
      setLoading(true);
      const query = `?user_id=${encodeURIComponent(learnerId)}`;
      const [progressResult, submissionsResult, revisionsResult, recommendationResult] =
        await Promise.allSettled([
          apiRequest<LearnerProgress>(`/progress/${query}`),
          apiRequest<Submission[]>(`/submissions/${query}`),
          apiRequest<RevisionTask[]>(`/revisions/${query}`),
          apiRequest<Recommendation>(`/recommendations/${query}`),
        ]);
      if (cancelled) return;

      const nextErrors: typeof errors = {};
      const message = (reason: unknown, fallback: string) =>
        reason instanceof Error ? reason.message : fallback;

      if (progressResult.status === "fulfilled") setProgress(progressResult.value);
      else {
        setProgress(null);
        nextErrors.progress = message(progressResult.reason, "Could not load learner progress.");
      }
      if (submissionsResult.status === "fulfilled") setSubmissions(submissionsResult.value);
      else {
        setSubmissions(null);
        nextErrors.submissions = message(submissionsResult.reason, "Could not load submissions.");
      }
      if (revisionsResult.status === "fulfilled") setRevisions(revisionsResult.value);
      else {
        setRevisions([]);
        nextErrors.revisions = message(revisionsResult.reason, "Revision tasks are unavailable.");
      }
      if (recommendationResult.status === "fulfilled") setRecommendation(recommendationResult.value);
      else {
        setRecommendation(null);
        const text = message(recommendationResult.reason, "Recommendation unavailable.");
        if (text !== NO_RECOMMENDATION_MESSAGE) nextErrors.recommendation = text;
      }
      setErrors(nextErrors);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [learnerId, reloadVersion]);

  const sortedSubmissions = useMemo(() => {
    if (!submissions) return [];
    return [...submissions].sort((a, b) => {
      const at = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
      const bt = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
      return bt - at || b.id - a.id;
    });
  }, [submissions]);

  const overallMastery = useMemo(() => {
    if (!progress?.patterns.length) return null;
    const total = progress.patterns.reduce((sum, p) => sum + p.mastery_score, 0);
    return total / progress.patterns.length;
  }, [progress]);

  const sortedPatterns = useMemo(
    () => (progress ? [...progress.patterns].sort((a, b) => a.mastery_score - b.mastery_score) : []),
    [progress],
  );

  const dayStreak = useMemo(() => practiceDayStreak(sortedSubmissions), [sortedSubmissions]);
  const correctRun = useMemo(() => currentCorrectRun(sortedSubmissions), [sortedSubmissions]);
  const activity = useMemo(() => bucketActivity(sortedSubmissions), [sortedSubmissions]);

  const weakest = progress?.weakest_pattern ?? null;
  const strongest = progress?.strongest_pattern ?? null;
  const hasAttempts = (progress?.total_attempts ?? 0) > 0;

  /* ----------------------------------------------------------- Rendering */

  if (!hydrated) {
    return <LoadingPanel label="Restoring learner" />;
  }

  if (!learnerId) {
    return (
      <div className="mx-auto max-w-2xl pt-6">
        <EmptyState
          icon={<IconUser size={22} />}
          title="Choose a learner to open the dashboard"
          body="The dashboard reads attempts, mastery and revision dates saved by the backend for one learner. Pick the ID you use on the practice page, or create a new learner."
          action={
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={learner.openPanel}>
                Choose or create a learner
              </Button>
              <LinkButton href="/practice">Go to practice</LinkButton>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight text-ink">
            {greeting()}, {learnerDisplayName(learner)}
          </h1>
          <p className="mt-1 text-[13.5px] text-muted">
            {loading
              ? "Loading your saved practice…"
              : hasAttempts
                ? "Here is where your practice stands, from evaluated attempts only."
                : "Nothing is recorded for this learner yet. Your first evaluated attempt starts the history."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setReloadVersion((v) => v + 1)} disabled={loading}>
            Refresh
          </Button>
          <LinkButton href="/practice" variant="primary" size="sm">
            Practise
            <IconArrowRight size={14} />
          </LinkButton>
        </div>
      </header>

      {learner.status === "missing" && (
        <ErrorState
          title={`No learner exists with ID ${learnerId}`}
          message="The backend returned 404 for this learner. Switch to an existing ID or create a new learner."
          action={<Button size="sm" onClick={learner.openPanel}>Change learner</Button>}
        />
      )}

      {loading && !progress ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <LoadingPanel key={i} lines={1} />
            ))}
          </div>
          <LoadingPanel lines={4} />
        </div>
      ) : errors.progress ? (
        <ErrorState
          title="Progress is unavailable"
          message={errors.progress}
          hint="Check that the backend is running, that the learner ID exists, and that BACKEND_API_URL is configured."
          action={<Button size="sm" onClick={() => setReloadVersion((v) => v + 1)}>Try again</Button>}
        />
      ) : progress ? (
        <div className={cx("space-y-6 transition-opacity", loading && "opacity-60")}>
          <section aria-label="Overview" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label="Evaluated attempts"
              value={progress.total_attempts}
              hint={`${progress.correct_attempts} accepted`}
              icon={<IconCheck size={16} />}
              tone="accent"
            />
            <StatTile
              label="Accuracy"
              value={hasAttempts ? formatPercent(progress.accuracy_percentage, progress.accuracy_percentage % 1 ? 1 : 0) : "—"}
              hint={hasAttempts ? "Accepted ÷ evaluated attempts" : "No attempts yet"}
              icon={<IconTarget size={16} />}
              tone="success"
            />
            <StatTile
              label="Overall mastery"
              value={overallMastery === null ? "—" : formatPercent(overallMastery)}
              hint={
                overallMastery === null
                  ? "Builds as you practise"
                  : `Average across ${pluralize(progress.patterns.length, "pattern")}`
              }
              icon={<IconFlame size={16} />}
              tone="warning"
            />
            <StatTile
              label="Day streak"
              value={errors.submissions ? "—" : dayStreak}
              hint={
                errors.submissions
                  ? "Submission history unavailable"
                  : correctRun > 0
                    ? `${pluralize(correctRun, "accepted attempt")} in a row`
                    : "Consecutive days with a submission"
              }
              icon={<IconFlame size={16} />}
              tone="danger"
            />
          </section>

          {!hasAttempts ? (
            <Panel className="p-5">
              <h2 className="text-[16px] font-semibold text-ink">Your progress starts with one attempt</h2>
              <p className="mt-1.5 max-w-2xl text-[13px] leading-5 text-muted">
                There are no saved submissions for this learner. Choose an evaluable problem and submit a
                solution; the verdict, mastery and activity will appear here.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <LinkButton href={recommendation ? `/practice?problem_id=${recommendation.problem_id}` : "/practice"} variant="primary" size="sm">
                  {recommendation ? `Start with ${recommendation.title}` : "Start practising"}
                  <IconArrowRight size={14} />
                </LinkButton>
              </div>
            </Panel>
          ) : (
            <>
              <section className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
                <Panel className="p-5">
                  <PanelHeader
                    title="Activity"
                    description="Submissions per day over the last two weeks"
                  />
                  {errors.submissions ? (
                    <ErrorState title="Submission history unavailable" message={errors.submissions} />
                  ) : (
                    <ActivityChart buckets={activity} />
                  )}
                </Panel>
                <Panel className="p-5">
                  <PanelHeader title="Verdicts" description="Share of each Judge0 outcome" />
                  {errors.submissions ? (
                    <p className="text-[13px] text-muted">Unavailable until submissions load.</p>
                  ) : (
                    <VerdictBreakdown submissions={sortedSubmissions} />
                  )}
                </Panel>
              </section>

              <section className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
                <Panel className="p-5">
                  <PanelHeader
                    title="Pattern mastery"
                    description="Lowest first, from your saved mastery records"
                    action={
                      weakest && (
                        <LinkButton href={`/practice?pattern_id=${weakest.pattern_id}`} size="sm">
                          Practise {weakest.pattern_name}
                        </LinkButton>
                      )
                    }
                  />
                  {sortedPatterns.length ? (
                    <ul className="divide-y divide-line-soft">
                      {sortedPatterns.map((pattern) => (
                        <PatternRow
                          key={pattern.pattern_id}
                          pattern={pattern}
                          label={
                            pattern.pattern_id === weakest?.pattern_id && sortedPatterns.length > 1
                              ? "Focus"
                              : pattern.pattern_id === strongest?.pattern_id && sortedPatterns.length > 1
                                ? "Strong"
                                : undefined
                          }
                        />
                      ))}
                    </ul>
                  ) : (
                    <EmptyState compact title="No pattern-level progress yet" />
                  )}
                </Panel>

                <div className="space-y-4">
                  <Panel className="p-5">
                    <PanelHeader title="Next up" description="Deterministic recommendation" compact />
                    {errors.recommendation ? (
                      <p className="text-[13px] text-danger">{errors.recommendation}</p>
                    ) : recommendation ? (
                      <>
                        <p className="text-[15px] font-semibold tracking-tight text-ink">{recommendation.title}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Badge tone={difficultyTone(recommendation.difficulty)}>{recommendation.difficulty}</Badge>
                          <Badge>{recommendation.pattern}</Badge>
                        </div>
                        <p className="mt-3 text-[12.5px] leading-5 text-muted">{recommendation.reason}</p>
                        <LinkButton
                          href={`/practice?problem_id=${recommendation.problem_id}`}
                          variant="primary"
                          size="sm"
                          className="mt-4"
                        >
                          Open problem
                          <IconArrowRight size={14} />
                        </LinkButton>
                      </>
                    ) : (
                      <p className="text-[13px] text-muted">No evaluable problem is available to recommend.</p>
                    )}
                  </Panel>

                  <Panel className="p-5">
                    <PanelHeader
                      title="Due revisions"
                      description={revisions.length ? pluralize(revisions.length, "pattern") + " due" : undefined}
                      compact
                      action={
                        <Link href="/revisions" className="text-[12.5px] font-medium text-accent-2 hover:underline">
                          View all
                        </Link>
                      }
                    />
                    {errors.revisions ? (
                      <p className="text-[13px] text-warning">{errors.revisions}</p>
                    ) : revisions.length ? (
                      <ul className="divide-y divide-line-soft">
                        {revisions.slice(0, 4).map((task) => (
                          <li key={task.pattern_id} className="py-2.5 first:pt-0 last:pb-0">
                            <Link
                              href={`/practice?pattern_id=${task.pattern_id}&problem_id=${task.problem_id}`}
                              className="focus-ring group block rounded"
                            >
                              <span className="flex items-center justify-between gap-2">
                                <span className="truncate text-[13px] font-medium text-ink group-hover:text-accent-2">
                                  {task.pattern_name}
                                </span>
                                <Badge tone={difficultyTone(task.difficulty)}>{task.difficulty}</Badge>
                              </span>
                              <span className="mt-0.5 block truncate text-[12px] text-faint">
                                {task.problem_title} · due {formatDate(task.due_at)}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[13px] text-muted">Nothing is due right now.</p>
                    )}
                  </Panel>
                </div>
              </section>

              <Panel className="p-0">
                <div className="px-5 pt-5">
                  <PanelHeader
                    title="Recent activity"
                    description="Your latest evaluated submissions"
                    action={
                      <Link href="/mistakes" className="text-[12.5px] font-medium text-accent-2 hover:underline">
                        Review mistakes
                      </Link>
                    }
                  />
                </div>
                {progress.recent_submissions.length ? (
                  <div className="scroll-quiet overflow-x-auto">
                    <table className="w-full min-w-[40rem] text-left text-[13px]">
                      <thead>
                        <tr className="border-y border-line-soft text-[11.5px] uppercase tracking-[0.08em] text-faint">
                          <th className="px-5 py-2.5 font-medium">Problem</th>
                          <th className="px-3 py-2.5 font-medium">Pattern</th>
                          <th className="px-3 py-2.5 font-medium">Language</th>
                          <th className="px-3 py-2.5 font-medium">Verdict</th>
                          <th className="px-5 py-2.5 text-right font-medium">When</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line-soft">
                        {progress.recent_submissions.map((submission) => (
                          <tr key={submission.id} className="transition-colors hover:bg-white/[0.025]">
                            <td className="max-w-[18rem] truncate px-5 py-2.5 font-medium text-ink">
                              <Link
                                href={`/practice?problem_id=${submission.problem_id}`}
                                className="focus-ring rounded hover:text-accent-2"
                              >
                                {submission.problem_title}
                              </Link>
                            </td>
                            <td className="px-3 py-2.5 text-muted">{submission.pattern_name}</td>
                            <td className="px-3 py-2.5 text-muted">{languageLabel(submission.language)}</td>
                            <td className="px-3 py-2.5">
                              <Badge tone={verdictTone(submission.status, submission.is_correct)} dot>
                                {submission.status}
                              </Badge>
                            </td>
                            <td
                              className="whitespace-nowrap px-5 py-2.5 text-right tabular-nums text-muted"
                              title={submission.submitted_at ?? undefined}
                            >
                              {formatRelative(submission.submitted_at)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="px-5 pb-5">
                    <EmptyState compact title="No recent submissions" />
                  </div>
                )}
              </Panel>
            </>
          )}
        </div>
      ) : null}

      <div className="flex flex-wrap items-baseline gap-2 text-[12px] text-faint">
        <Eyebrow>Source</Eyebrow>
        <span>All figures come from saved submissions and mastery records. Nothing here is estimated.</span>
      </div>
    </div>
  );
}
