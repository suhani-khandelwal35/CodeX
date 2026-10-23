"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

import { apiRequest, type Pattern, type Problem, type Submission } from "./api";
import { CodeEditor } from "../components/code-editor";
import { useLearner } from "../components/learner-context";
import { IconExternal, IconSend, IconSparkle } from "../components/icons";
import { ResultPanel } from "../components/result-panel";
import {
  Badge,
  Button,
  CodeBlock,
  EmptyState,
  ErrorState,
  Eyebrow,
  InlineNotice,
  LoadingPanel,
  Panel,
  cx,
  difficultyTone,
} from "../components/ui";
import { takePracticePrefill } from "../lib/storage";
import { pluralize } from "../lib/format";

const LANGUAGES = [
  { value: "python", label: "Python 3" },
  { value: "java", label: "Java (class Main)" },
] as const;

const PLACEHOLDER: Record<string, string> = {
  python: "# Read from standard input, print the answer to standard output\nimport sys\n\ndata = sys.stdin.read().split()\n",
  java: "import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner in = new Scanner(System.in);\n    }\n}\n",
};

export default function PracticePage() {
  const learner = useLearner();
  const { learnerId } = learner;

  const [problems, setProblems] = useState<Problem[]>([]);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [problemId, setProblemId] = useState("");
  const [language, setLanguage] = useState("python");
  const [code, setCode] = useState("");
  const [result, setResult] = useState<Submission | null>(null);
  const [loadingProblems, setLoadingProblems] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [prefilledFrom, setPrefilledFrom] = useState<number | null>(null);

  // Guards against a second click or Enter press landing before React
  // re-renders the disabled button.
  const submitInFlight = useRef(false);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPracticeData() {
      try {
        const [problemList, patternList] = await Promise.all([
          apiRequest<Problem[]>("/problems/"),
          apiRequest<Pattern[]>("/patterns/"),
        ]);
        if (cancelled) return;
        setProblems(problemList);
        setPatterns(patternList);

        const query = new URLSearchParams(window.location.search);
        const prefill = takePracticePrefill();
        const requestedPatternId = Number(query.get("pattern_id"));
        const requestedProblemId = Number(query.get("problem_id")) || prefill?.problemId || 0;
        const patternMatches = (problem: Problem) =>
          !Number.isInteger(requestedPatternId) ||
          requestedPatternId <= 0 ||
          problem.pattern_id === requestedPatternId;

        const requestedProblem = problemList.find(
          (problem) => problem.id === requestedProblemId && patternMatches(problem),
        );
        const firstRunnable =
          requestedProblem ??
          problemList.find(
            (problem) =>
              problem.test_cases_available &&
              Number.isInteger(requestedPatternId) &&
              requestedPatternId > 0 &&
              problem.pattern_id === requestedPatternId,
          ) ??
          problemList.find((problem) => problem.test_cases_available) ??
          problemList[0];
        setProblemId(firstRunnable ? String(firstRunnable.id) : "");

        if (prefill && requestedProblem && prefill.problemId === requestedProblem.id) {
          setCode(prefill.code);
          if (LANGUAGES.some((item) => item.value === prefill.language)) {
            setLanguage(prefill.language);
          }
          setPrefilledFrom(prefill.problemId);
        }
        if (problemList.length === 0) {
          setLoadError("There are no problems available to practise yet.");
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Could not load practice problems.");
        }
      } finally {
        if (!cancelled) setLoadingProblems(false);
      }
    }

    void loadPracticeData();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedProblem = problems.find((problem) => String(problem.id) === problemId);
  const patternById = useMemo(() => new Map(patterns.map((p) => [p.id, p])), [patterns]);
  const selectedPattern = selectedProblem ? patternById.get(selectedProblem.pattern_id) : undefined;
  const runnableCount = useMemo(
    () => problems.filter((problem) => problem.test_cases_available).length,
    [problems],
  );
  const groupedProblems = useMemo(() => {
    const groups = new Map<number, Problem[]>();
    for (const problem of problems) {
      const list = groups.get(problem.pattern_id) ?? [];
      list.push(problem);
      groups.set(problem.pattern_id, list);
    }
    return [...groups.entries()];
  }, [problems]);

  function selectProblem(nextId: string) {
    setProblemId(nextId);
    setResult(null);
    setSubmitError("");
    setPrefilledFrom(null);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("problem_id", nextId);
      url.searchParams.delete("pattern_id");
      window.history.replaceState(null, "", url);
    }
  }

  async function submitAttempt(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (submitInFlight.current) return;
    setSubmitError("");

    const parsedUserId = Number(learnerId);
    if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
      setSubmitError("Choose a learner before submitting. Use the account control in the top bar.");
      return;
    }
    if (!selectedProblem) {
      setSubmitError("Choose a problem before submitting.");
      return;
    }
    if (!selectedProblem.test_cases_available) {
      setSubmitError("This problem cannot be evaluated until test cases are configured.");
      return;
    }
    if (!code.trim()) {
      setSubmitError("Add your solution before submitting.");
      return;
    }

    submitInFlight.current = true;
    setSubmitting(true);
    setResult(null);
    try {
      const submission = await apiRequest<Submission>("/submissions/", {
        method: "POST",
        body: JSON.stringify({
          user_id: parsedUserId,
          problem_id: selectedProblem.id,
          code,
          language,
        }),
      });
      setResult(submission);
      requestAnimationFrame(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Your submission could not be evaluated. Please try again.",
      );
    } finally {
      submitInFlight.current = false;
      setSubmitting(false);
    }
  }

  function handleEditorShortcut(event: KeyboardEvent<HTMLFormElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      void submitAttempt();
    }
  }

  function openRecommendedProblem(nextProblemId: number) {
    selectProblem(String(nextProblemId));
    setCode("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const lineCount = code ? code.split("\n").length : 0;
  const canSubmit = Boolean(selectedProblem?.test_cases_available) && !submitting && !loadingProblems;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight text-ink">Practice</h1>
          <p className="mt-1 text-[13.5px] text-muted">
            Solve, submit, and read the judged verdict beside the problem.
            {runnableCount > 0 && ` ${runnableCount} of ${problems.length} problems can be evaluated.`}
          </p>
        </div>
        {learner.hydrated && !learnerId && (
          <Button size="sm" variant="primary" onClick={learner.openPanel}>
            Choose a learner to submit
          </Button>
        )}
      </header>

      {loadError && (
        <ErrorState
          title="Problems could not be loaded"
          message={loadError}
          hint="Check that the backend is running and BACKEND_API_URL is configured correctly."
        />
      )}

      {loadingProblems ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <LoadingPanel lines={6} label="Loading problems" />
          <LoadingPanel lines={8} label="Preparing editor" />
        </div>
      ) : selectedProblem ? (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          {/* ------------------------------------------------ Problem */}
          <Panel className="p-5 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6.5rem)] lg:overflow-y-auto scroll-quiet">
            <label className="block">
              <span className="sr-only">Problem</span>
              <select
                value={problemId}
                onChange={(event) => selectProblem(event.target.value)}
                className="field h-9 !py-0 text-[13px]"
              >
                {groupedProblems.map(([patternId, list]) => (
                  <optgroup key={patternId} label={patternById.get(patternId)?.name ?? `Pattern ${patternId}`}>
                    {list.map((problem) => (
                      <option key={problem.id} value={problem.id}>
                        {problem.title}
                        {problem.test_cases_available ? "" : " (not evaluable)"}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>

            <div className="mt-4">
              <Eyebrow>Problem {selectedProblem.id}</Eyebrow>
              <h2 className="mt-1 text-[20px] font-semibold leading-snug tracking-tight text-ink">
                {selectedProblem.title}
              </h2>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <Badge tone={difficultyTone(selectedProblem.difficulty)}>{selectedProblem.difficulty}</Badge>
                <Badge tone="accent">{selectedPattern?.name ?? "Pattern"}</Badge>
                {!selectedProblem.test_cases_available && <Badge tone="warning">Not evaluable</Badge>}
              </div>
            </div>

            <div className="mt-4 whitespace-pre-wrap text-[13.5px] leading-6 text-ink/90">
              {selectedProblem.description ||
                "No console input/output contract has been added for this problem yet."}
            </div>

            {selectedProblem.url && (
              <a
                href={selectedProblem.url}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-ring mt-3 inline-flex items-center gap-1.5 rounded text-[13px] font-medium text-accent-2 hover:underline"
              >
                Original problem statement
                <IconExternal size={13} />
              </a>
            )}

            {selectedProblem.test_cases_available ? (
              selectedProblem.sample_cases.length > 0 && (
                <div className="mt-5 space-y-3 border-t border-line-soft pt-4">
                  <div>
                    <p className="text-[13px] font-semibold text-ink">Sample cases</p>
                    <p className="text-[12px] text-muted">Read from standard input, print to standard output.</p>
                  </div>
                  {selectedProblem.sample_cases.map((sample, index) => (
                    <div key={index} className="grid gap-2 sm:grid-cols-2">
                      <div className="min-w-0">
                        <Eyebrow className="mb-1">Input {index + 1}</Eyebrow>
                        <CodeBlock maxHeight="10rem">{sample.input}</CodeBlock>
                      </div>
                      <div className="min-w-0">
                        <Eyebrow className="mb-1">Expected {index + 1}</Eyebrow>
                        <CodeBlock maxHeight="10rem">{sample.expected_output}</CodeBlock>
                      </div>
                    </div>
                  ))}
                  <p className="text-[12px] leading-5 text-faint">
                    Hidden cases are also run. Trailing whitespace is ignored when comparing output.
                  </p>
                </div>
              )
            ) : (
              <div className="mt-5">
                <InlineNotice tone="warning">
                  Evaluation is unavailable for this problem until its test cases are configured.
                  {runnableCount > 0 && ` ${pluralize(runnableCount, "other problem")} can be evaluated.`}
                </InlineNotice>
              </div>
            )}

            {selectedPattern?.description && (
              <div className="mt-5 border-t border-line-soft pt-4">
                <Eyebrow>About {selectedPattern.name}</Eyebrow>
                <p className="mt-1.5 text-[13px] leading-5 text-muted">{selectedPattern.description}</p>
              </div>
            )}
          </Panel>

          {/* ------------------------------------------------- Editor */}
          <div className="space-y-4">
            <Panel as="div" className="overflow-hidden p-0">
              <form onSubmit={submitAttempt} onKeyDown={handleEditorShortcut}>
                <div className="flex flex-wrap items-center gap-2 border-b border-line-soft px-3 py-2.5">
                  <label className="flex items-center gap-2 text-[12.5px] text-muted">
                    <span className="sr-only">Language</span>
                    <select
                      value={language}
                      onChange={(event) => setLanguage(event.target.value)}
                      className="field h-8 w-auto !py-0 text-[12.5px]"
                    >
                      {LANGUAGES.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <span className="hidden text-[12px] tabular-nums text-faint sm:inline">
                    {pluralize(lineCount, "line")}
                  </span>
                  {prefilledFrom === selectedProblem.id && (
                    <Badge tone="accent">Loaded from a previous attempt</Badge>
                  )}
                  <div className="ml-auto flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={!code || submitting}
                      onClick={() => {
                        setCode("");
                        setPrefilledFrom(null);
                      }}
                    >
                      Reset
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      variant="primary"
                      disabled={!canSubmit}
                      aria-busy={submitting}
                      title="Ctrl+Enter"
                    >
                      {submitting ? (
                        <>
                          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#1a0f21]/30 border-t-[#1a0f21]" aria-hidden />
                          Evaluating…
                        </>
                      ) : (
                        <>
                          <IconSend size={14} />
                          Submit
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <div className="p-3">
                  <CodeEditor
                    value={code}
                    onChange={setCode}
                    language={language}
                    placeholder={PLACEHOLDER[language]}
                    disabled={submitting}
                    minLines={18}
                    className="max-h-[32rem]"
                  />
                </div>

                <div className="flex flex-col gap-2 border-t border-line-soft px-4 py-3 text-[12px] leading-5 text-faint sm:flex-row sm:items-center sm:justify-between">
                  <p>
                    Submitting sends the code to the external Judge0 sandbox and saves the verdict.
                    {submitting && " This can take up to 45 seconds."}
                  </p>
                  <p className="hidden sm:block">Ctrl / ⌘ + Enter to submit</p>
                </div>
              </form>

              {submitError && (
                <div className="border-t border-line-soft px-4 py-3">
                  <ErrorState
                    title="Submission not evaluated"
                    message={submitError}
                    action={
                      !learnerId ? (
                        <Button size="sm" onClick={learner.openPanel}>
                          Choose a learner
                        </Button>
                      ) : undefined
                    }
                  />
                </div>
              )}
            </Panel>

            <div ref={resultRef}>
              <Panel className={cx("p-5", submitting && "opacity-70")}>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-[15px] font-semibold tracking-tight text-ink">Result</h2>
                    <p className="mt-0.5 text-[13px] text-muted">
                      Verdict, feedback, mastery and the next recommended problem.
                    </p>
                  </div>
                  {result && <Badge>Submission #{result.id}</Badge>}
                </div>
                {result ? (
                  <ResultPanel
                    submission={result}
                    patternName={selectedPattern?.name}
                    onPracticeRecommended={openRecommendedProblem}
                  />
                ) : (
                  <EmptyState
                    compact
                    icon={<IconSparkle size={20} />}
                    title={submitting ? "Waiting for the judge…" : "No result yet"}
                    body={
                      submitting
                        ? "Judge0 is compiling and running your program against every test case."
                        : "Submit an attempt to see the Judge0 verdict, advisory feedback, updated mastery and a suggested next problem."
                    }
                  />
                )}
              </Panel>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
