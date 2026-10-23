"use client";

import { useEffect, useState } from "react";

import { apiRequest, type RevisionTask } from "../practice/api";
import { useLearner } from "../components/learner-context";
import { IconArrowRight, IconClock, IconRefresh, IconUser } from "../components/icons";
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
  difficultyTone,
  masteryTone,
} from "../components/ui";
import { formatDateTime, formatPercent, pluralize } from "../lib/format";

function dueLabel(dueAt: string): { text: string; overdue: boolean } {
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return { text: "Date unavailable", overdue: false };
  const days = Math.floor((Date.now() - due.getTime()) / 86_400_000);
  if (days <= 0) return { text: "Due today", overdue: false };
  if (days === 1) return { text: "1 day overdue", overdue: true };
  return { text: `${days} days overdue`, overdue: true };
}

export default function RevisionsPage() {
  const learner = useLearner();
  const { learnerId, hydrated } = learner;

  const [tasks, setTasks] = useState<RevisionTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reloadVersion, setReloadVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!learnerId) {
        setTasks([]);
        setError("");
        return;
      }
      setLoading(true);
      setError("");
      try {
        const result = await apiRequest<RevisionTask[]>(
          `/revisions/?user_id=${encodeURIComponent(learnerId)}`,
        );
        if (!cancelled) setTasks(result);
      } catch (requestError) {
        if (!cancelled) {
          setTasks([]);
          setError(requestError instanceof Error ? requestError.message : "Could not load revision tasks.");
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

  if (!hydrated) return <LoadingPanel label="Restoring learner" />;

  if (!learnerId) {
    return (
      <div className="mx-auto max-w-2xl pt-6">
        <EmptyState
          icon={<IconUser size={22} />}
          title="Choose a learner to view revisions"
          body="Due reviews are selected from the revision dates saved with each pattern's mastery record."
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
          <h1 className="text-[24px] font-semibold tracking-tight text-ink">Revisions</h1>
          <p className="mt-1 text-[13.5px] text-muted">
            {loading
              ? "Checking saved revision dates…"
              : tasks.length
                ? `${pluralize(tasks.length, "pattern")} due, weakest mastery first.`
                : "Patterns reappear here when their saved revision date is reached."}
          </p>
        </div>
        <Button size="sm" onClick={() => setReloadVersion((v) => v + 1)} disabled={loading}>
          Refresh
        </Button>
      </header>

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          <LoadingPanel lines={4} label="Loading revisions" />
          <LoadingPanel lines={4} label="Loading revisions" />
        </div>
      ) : error ? (
        <ErrorState
          title="Revision tasks are unavailable"
          message={error}
          hint="Check that the backend is running and the learner ID exists."
          action={<Button size="sm" onClick={() => setReloadVersion((v) => v + 1)}>Try again</Button>}
        />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={<IconRefresh size={22} />}
          title="Nothing is due right now"
          body="There are no due revision tasks with evaluable problems for this learner. The first revision of a pattern is scheduled at least a day after practising it."
          action={<LinkButton href="/practice">Continue practising</LinkButton>}
        />
      ) : (
        <ol className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {tasks.map((task, index) => {
            const due = dueLabel(task.due_at);
            return (
              <Panel as="li" key={task.pattern_id} className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Eyebrow>Revision {index + 1}</Eyebrow>
                    <h2 className="mt-1 truncate text-[17px] font-semibold tracking-tight text-ink">
                      {task.pattern_name}
                    </h2>
                  </div>
                  <Badge tone={due.overdue ? "warning" : "accent"} dot>
                    {due.text}
                  </Badge>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-[12.5px]">
                    <span className="text-muted">Mastery</span>
                    <span className="font-semibold tabular-nums text-ink">{formatPercent(task.mastery_score)}</span>
                  </div>
                  <Meter
                    className="mt-1.5"
                    value={task.mastery_score}
                    tone={masteryTone(task.mastery_score)}
                    label={`${task.pattern_name} mastery`}
                  />
                </div>

                <p className="mt-4 text-[13px] leading-5 text-muted">{task.reason}</p>

                <div className="mt-4 flex items-center gap-2 text-[12px] text-faint">
                  <IconClock size={14} />
                  <span>Due {formatDateTime(task.due_at)}</span>
                  <span className="ml-auto">Priority {task.priority.toFixed(0)}</span>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 border-t border-line-soft pt-4">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-ink">{task.problem_title}</p>
                    <Badge tone={difficultyTone(task.difficulty)} className="mt-1">
                      {task.difficulty}
                    </Badge>
                  </div>
                  <LinkButton
                    href={`/practice?pattern_id=${task.pattern_id}&problem_id=${task.problem_id}`}
                    variant="primary"
                    size="sm"
                  >
                    Review
                    <IconArrowRight size={14} />
                  </LinkButton>
                </div>
              </Panel>
            );
          })}
        </ol>
      )}
    </div>
  );
}
