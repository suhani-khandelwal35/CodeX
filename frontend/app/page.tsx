"use client";

import Link from "next/link";

import { learnerDisplayName, useLearner } from "./components/learner-context";
import {
  IconAlert,
  IconArrowRight,
  IconCode,
  IconCompass,
  IconGrid,
  IconRefresh,
} from "./components/icons";
import { Eyebrow, LinkButton, Panel } from "./components/ui";

const steps = [
  {
    title: "Pick a problem",
    body: "Each runnable problem states its console input/output contract and shows visible sample cases.",
  },
  {
    title: "Submit Python or Java",
    body: "The backend sends your code to an external Judge0 sandbox. The browser never decides a verdict.",
  },
  {
    title: "Learn from the result",
    body: "Verdicts update pattern mastery, record mistakes with feedback, and pick what to practise next.",
  },
];

const destinations = [
  {
    href: "/dashboard",
    label: "Dashboard",
    body: "Attempts, accuracy, mastery and recent activity.",
    icon: IconGrid,
  },
  {
    href: "/practice",
    label: "Practice",
    body: "Problem statement beside a code editor with a judged verdict.",
    icon: IconCode,
  },
  {
    href: "/recommendations",
    label: "Next problem",
    body: "One deterministic recommendation from your mastery history.",
    icon: IconCompass,
  },
  {
    href: "/revisions",
    label: "Revisions",
    body: "Patterns whose saved revision date has come due.",
    icon: IconRefresh,
  },
  {
    href: "/mistakes",
    label: "Mistake review",
    body: "Failed attempts with the judge output and feedback that explains them.",
    icon: IconAlert,
  },
];

export default function Home() {
  const learner = useLearner();
  const hasLearner = Boolean(learner.learnerId);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <section className="pt-2">
        <Eyebrow>CodeX</Eyebrow>
        <h1 className="mt-2 max-w-2xl text-[28px] font-semibold leading-tight tracking-tight text-ink sm:text-[32px]">
          Master coding patterns, one evaluated attempt at a time.
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-7 text-muted">
          A practice workspace that grades real code in a sandbox, tracks mastery per pattern,
          and turns every mistake into a concrete next step.
        </p>
        <div className="mt-6 flex flex-wrap gap-2.5">
          <LinkButton href="/practice" variant="primary">
            Start practising
            <IconArrowRight size={16} />
          </LinkButton>
          <LinkButton href="/dashboard">
            {hasLearner ? `Continue as ${learnerDisplayName(learner)}` : "View dashboard"}
          </LinkButton>
          {!hasLearner && learner.hydrated && (
            <button
              type="button"
              onClick={learner.openPanel}
              className="focus-ring inline-flex h-10 items-center rounded-[10px] px-3 text-sm font-medium text-accent-2 hover:underline"
            >
              Choose or create a learner
            </button>
          )}
        </div>
      </section>

      <section aria-label="How it works">
        <ol className="grid gap-3 sm:grid-cols-3">
          {steps.map((step, index) => (
            <Panel as="li" key={step.title} className="p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-2">
                Step {index + 1}
              </p>
              <h2 className="mt-2 text-[15px] font-semibold text-ink">{step.title}</h2>
              <p className="mt-1.5 text-[13px] leading-5 text-muted">{step.body}</p>
            </Panel>
          ))}
        </ol>
      </section>

      <section aria-label="Workspace">
        <Eyebrow className="mb-3">Workspace</Eyebrow>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {destinations.map(({ href, label, body, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className="glass focus-ring group flex h-full items-start gap-3 rounded-panel p-4 transition-colors hover:border-line"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent ring-1 ring-accent/20">
                  <Icon size={18} />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-[14px] font-semibold text-ink">
                    {label}
                    <IconArrowRight
                      size={14}
                      className="text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-accent-2"
                    />
                  </span>
                  <span className="mt-1 block text-[13px] leading-5 text-muted">{body}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <Panel className="p-4 sm:p-5">
        <Eyebrow>How verdicts work</Eyebrow>
        <p className="mt-2 max-w-3xl text-[13px] leading-6 text-muted">
          Every submission is executed by Judge0 against visible and hidden test cases. The
          judge&apos;s status is the verdict. Explanations shown beside a result, whether
          generated by an AI provider or by the built-in rules, are advisory and never change
          acceptance, mastery or recommendations.
        </p>
      </Panel>
    </div>
  );
}
