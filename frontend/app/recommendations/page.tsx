"use client";

import { useEffect, useMemo, useState } from "react";

import { apiRequest, type LearnerProgress, type Recommendation } from "../practice/api";
import { useLearner } from "../components/learner-context";
import { IconArrowRight, IconCompass, IconUser } from "../components/icons";
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
  difficultyTone,
  masteryTone,
} from "../components/ui";
import { formatPercent, pluralize } from "../lib/format";

const NO_RECOMMENDATION_MESSAGE = "No problems with usable test cases are available";

const RULES = [
  { label: "Low mastery", body: "An easier problem in the weakest pattern." },
  { label: "Developing", body: "A difficulty close to your most recent attempt." },
  { label: "Strong", body: "A harder problem to stretch the pattern." },
  { label: "Always", body: "Unattempted, evaluable problems are preferred." },
];

export default function RecommendationsPage() {
  const learner = useLearner();
  const { learnerId, hydrated } = learner;

  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [progress, setProgress] = useState<LearnerProgress | null>(null);
  const [loading, setLoading] = useState(false);
  const [isEmpty, setIsEmpty] = useState(false);
  const [error, setError] = useState("");
  const [reloadVersion, setReloadVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!learnerId) {
        setRecommendation(null);
        setProgress(null);
        setError("");
        setIsEmpty(false);
        return;
      }
      setLoading(true);
      setIsEmpty(false);
      setError("");
      const query = `?user_id=${encodeURIComponent(learnerId)}`;
      const [recommendationResult, progressResult] = await Promise.allSettled([
        apiRequest<Recommendation>(`/recommendations/${query}`),
        apiRequest<LearnerProgress>(`/progress/${query}`),
      ]);
      if (cancelled) return;

      if (recommendationResult.status === "fulfilled") {
        setRecommendation(recommendationResult.value);
      } else {
        setRecommendation(null);
        const message =
          recommendationResult.reason instanceof Error
            ? recommendationResult.reason.message
            : "Could not load a recommendation.";
        if (message === NO_RECOMMENDATION_MESSAGE) setIsEmpty(true);
        else setError(message);
      }
      // Progress is context only; its failure must not hide the recommendation.
      setProgress(progressResult.status === "fulfilled" ? progressResult.value : null);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [learnerId, reloadVersion]);

  const weakestPatterns = useMemo(
    () => (progress ? [...progress.patterns].sort((a, b) => a.mastery_score - b.mastery_score).slice(0, 4) : []),
    [progress],
  );

  if (!hydrated) return <LoadingPanel label="Restoring learner" />;

  if (!learnerId) {
    return (
      <div className="mx-auto max-w-2xl pt-6">
        <EmptyState
          icon={<IconUser size={22} />}
          title="Choose a learner to personalise practice"
          body="Recommendations are computed from one learner's saved mastery and submission history."
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
          <h1 className="text-[24px] font-semibold tracking-tight text-ink">Next problem</h1>
          <p className="mt-1 text-[13.5px] text-muted">
            One deterministic recommendation from your saved mastery and practice history.
          </p>
        </div>
        <Button size="sm" onClick={() => setReloadVersion((v) => v + 1)} disabled={loading}>
          Refresh
        </Button>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          {loading ? (
            <LoadingPanel lines={4} label="Loading recommendation" />
          ) : error ? (
            <ErrorState
              title="Recommendation is unavailable"
              message={error}
              hint="Check that the backend is running and the learner ID exists."
              action={<Button size="sm" onClick={() => setReloadVersion((v) => v + 1)}>Try again</Button>}
            />
          ) : isEmpty ? (
            <EmptyState
              icon={<IconCompass size={22} />}
              title="No evaluable problems available"
              body="The backend has no problems with usable test cases to recommend right now."
              action={<LinkButton href="/practice">Browse practice</LinkButton>}
            />
          ) : recommendation ? (
            <Panel as="article" className="relative overflow-hidden p-5 sm:p-6">
              <div
                aria-hidden
                className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-accent/10 blur-3xl"
              />
              <Eyebrow>Recommended next</Eyebrow>
              <h2 className="mt-2 text-[22px] font-semibold leading-snug tracking-tight text-ink">
                {recommendation.title}
              </h2>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge tone={difficultyTone(recommendation.difficulty)}>{recommendation.difficulty}</Badge>
                <Badge tone="accent">{recommendation.pattern}</Badge>
                <Badge>Priority {recommendation.priority.toFixed(0)}</Badge>
              </div>
              <div className="mt-5 rounded-xl border border-line-soft bg-surface-raised/60 p-4">
                <p className="text-[12.5px] font-semibold text-ink">Why this problem</p>
                <p className="mt-1 text-[13px] leading-6 text-muted">{recommendation.reason}</p>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <LinkButton href={`/practice?problem_id=${recommendation.problem_id}`} variant="primary">
                  Practise this problem
                  <IconArrowRight size={16} />
                </LinkButton>
                <LinkButton href="/dashboard">View dashboard</LinkButton>
              </div>
            </Panel>
          ) : null}

          <Panel className="p-5">
            <PanelHeader title="How the pick is made" description="Rule-based and deterministic; no machine learning" />
            <dl className="grid gap-3 sm:grid-cols-2">
              {RULES.map((rule) => (
                <div key={rule.label} className="rounded-lg border border-line-soft bg-surface-sunken/60 p-3">
                  <dt className="text-[12.5px] font-semibold text-ink">{rule.label}</dt>
                  <dd className="mt-0.5 text-[12.5px] leading-5 text-muted">{rule.body}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        </div>

        <Panel className="p-5">
          <PanelHeader
            title="Mastery context"
            description={progress ? "Your lowest-mastery patterns" : "From saved mastery records"}
            compact
          />
          {loading ? (
            <div className="space-y-3" aria-hidden>
              <div className="skeleton h-3 w-2/3" />
              <div className="skeleton h-3 w-1/2" />
            </div>
          ) : !progress ? (
            <p className="text-[13px] text-muted">Progress could not be loaded for this learner.</p>
          ) : weakestPatterns.length === 0 ? (
            <p className="text-[13px] text-muted">
              No attempts yet. The first recommendation is the easiest evaluable problem.
            </p>
          ) : (
            <ul className="divide-y divide-line-soft">
              {weakestPatterns.map((pattern) => (
                <li key={pattern.pattern_id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="truncate font-medium text-ink">{pattern.pattern_name}</span>
                    <span className="tabular-nums text-muted">{formatPercent(pattern.mastery_score)}</span>
                  </div>
                  <Meter
                    className="mt-1.5"
                    value={pattern.mastery_score}
                    tone={masteryTone(pattern.mastery_score)}
                    label={`${pattern.pattern_name} mastery`}
                  />
                  <p className="mt-1 text-[11.5px] text-faint">
                    {pluralize(pattern.total_attempts, "attempt")} · {pattern.accuracy_percentage}% accuracy
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
