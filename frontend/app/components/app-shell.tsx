"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from "react";

import { apiRequest, type Problem, type RevisionTask } from "../practice/api";
import { formatDate, initials } from "../lib/format";
import { learnerDisplayName, useLearner } from "./learner-context";
import {
  IconAlert,
  IconBell,
  IconBook,
  IconClose,
  IconCode,
  IconCompass,
  IconExternal,
  IconGrid,
  IconHome,
  IconLogo,
  IconMenu,
  IconRefresh,
  IconSearch,
  IconUser,
} from "./icons";
import { Badge, Button, cx, difficultyTone } from "./ui";

/* ------------------------------------------------------------ Navigation */

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: IconHome },
  { href: "/dashboard", label: "Dashboard", icon: IconGrid },
  { href: "/practice", label: "Practice", icon: IconCode },
  { href: "/recommendations", label: "Next problem", icon: IconCompass },
  { href: "/revisions", label: "Revisions", icon: IconRefresh },
  { href: "/mistakes", label: "Mistake review", icon: IconAlert },
] as const;

const PAGE_TITLES: Record<string, string> = {
  "/": "Home",
  "/dashboard": "Dashboard",
  "/practice": "Practice",
  "/recommendations": "Next problem",
  "/revisions": "Revisions",
  "/mistakes": "Mistake review",
};

function useDismiss(ref: RefObject<HTMLElement | null>, open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    }
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [ref, open, onClose]);
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const learner = useLearner();

  return (
    <div className="flex h-full flex-col">
      <Link
        href="/"
        onClick={onNavigate}
        className="focus-ring mx-3 mt-4 flex items-center gap-2.5 rounded-lg px-2 py-1.5"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent ring-1 ring-accent/30">
          <IconLogo />
        </span>
        <span className="leading-tight">
          <span className="block text-[15px] font-semibold tracking-tight text-ink">CodeX</span>
          <span className="block text-[11px] text-faint">Pattern mastery</span>
        </span>
      </Link>

      <nav className="mt-6 flex-1 px-3" aria-label="Main navigation">
        <p className="px-2 pb-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-faint">
          Workspace
        </p>
        <ul className="space-y-0.5">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "focus-ring group relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors",
                    active
                      ? "bg-accent/[0.12] text-ink"
                      : "text-muted hover:bg-white/[0.04] hover:text-ink",
                  )}
                >
                  {active && (
                    <span
                      aria-hidden
                      className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r bg-accent"
                    />
                  )}
                  <Icon size={17} className={cx(active ? "text-accent" : "text-faint group-hover:text-muted")} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="space-y-2 px-3 pb-4">
        <a
          href="/api/backend/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="focus-ring flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium text-muted transition-colors hover:bg-white/[0.04] hover:text-ink"
        >
          <IconBook size={17} className="text-faint" />
          API docs
          <IconExternal size={13} className="ml-auto text-faint" />
        </a>
        <button
          type="button"
          onClick={() => {
            onNavigate?.();
            learner.openPanel();
          }}
          className="focus-ring flex w-full items-center gap-2.5 rounded-xl border border-line-soft bg-surface px-2.5 py-2 text-left transition-colors hover:border-line"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-2/15 text-[12px] font-semibold text-accent-2">
            {learner.learner ? initials(learner.learner.name) : <IconUser size={16} />}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-medium text-ink">
              {learner.learnerId ? learnerDisplayName(learner) : "No learner selected"}
            </span>
            <span className="block truncate text-[11.5px] text-faint">
              {learner.learnerId ? `ID ${learner.learnerId}` : "Choose or create one"}
            </span>
          </span>
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Search */

function ProblemSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [problems, setProblems] = useState<Problem[] | null>(null);
  const [error, setError] = useState("");
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(wrapRef, open, close);

  const ensureLoaded = useCallback(() => {
    if (problems !== null) return;
    apiRequest<Problem[]>("/problems/")
      .then(setProblems)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load problems."));
  }, [problems]);

  const results = useMemo(() => {
    if (!problems) return [];
    const needle = query.trim().toLowerCase();
    const list = needle
      ? problems.filter(
          (p) =>
            p.title.toLowerCase().includes(needle) ||
            p.difficulty.toLowerCase() === needle ||
            String(p.id) === needle,
        )
      : problems;
    return list.slice(0, 8);
  }, [problems, query]);

  function go(problem: Problem) {
    setOpen(false);
    setQuery("");
    router.push(`/practice?problem_id=${problem.id}`);
  }

  return (
    <div ref={wrapRef} className="relative w-full max-w-[22rem]">
      <label className="relative block">
        <span className="sr-only">Search problems</span>
        <IconSearch
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
        />
        <input
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls="problem-search-results"
          aria-autocomplete="list"
          value={query}
          placeholder="Search problems"
          onFocus={() => {
            ensureLoaded();
            setOpen(true);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((i) => Math.min(results.length - 1, i + 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((i) => Math.max(0, i - 1));
            } else if (event.key === "Enter" && results[active]) {
              event.preventDefault();
              go(results[active]);
            }
          }}
          className="field h-9 pl-9 pr-3 !py-0"
        />
      </label>
      {open && (
        <div
          id="problem-search-results"
          role="listbox"
          className="glass-pop absolute left-0 right-0 top-11 z-40 overflow-hidden rounded-xl p-1.5"
        >
          {error ? (
            <p className="px-3 py-2 text-[13px] text-danger">{error}</p>
          ) : problems === null ? (
            <p className="px-3 py-2 text-[13px] text-muted">Loading problems…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-[13px] text-muted">No problems match “{query}”.</p>
          ) : (
            results.map((problem, index) => (
              <button
                key={problem.id}
                type="button"
                role="option"
                aria-selected={index === active}
                onMouseEnter={() => setActive(index)}
                onClick={() => go(problem)}
                className={cx(
                  "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
                  index === active ? "bg-white/[0.05]" : "hover:bg-white/[0.04]",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink">
                    {problem.title}
                  </span>
                  <span className="block text-[11.5px] text-faint">
                    #{problem.id}
                    {!problem.test_cases_available && " · not evaluable"}
                  </span>
                </span>
                <Badge tone={difficultyTone(problem.difficulty)}>{problem.difficulty}</Badge>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------- Notifications */

function RevisionBell() {
  const { learnerId, status } = useLearner();
  const [tasks, setTasks] = useState<RevisionTask[]>([]);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(wrapRef, open, close);

  useEffect(() => {
    let cancelled = false;

    async function loadDue() {
      if (!learnerId || status !== "ready") {
        setTasks([]);
        setError("");
        return;
      }
      try {
        const result = await apiRequest<RevisionTask[]>(
          `/revisions/?user_id=${encodeURIComponent(learnerId)}`,
        );
        if (cancelled) return;
        setTasks(result);
        setError("");
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Revisions unavailable.");
      }
    }

    void loadDue();
    return () => {
      cancelled = true;
    };
  }, [learnerId, status]);

  const count = tasks.length;

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-label={count ? `${count} revisions due` : "Revisions"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="focus-ring relative flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-white/[0.05] hover:text-ink"
      >
        <IconBell size={18} />
        {count > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-[#1a0f21]">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>
      {open && (
        <div className="glass-pop absolute right-0 top-11 z-40 w-80 rounded-xl p-2">
          <div className="flex items-center justify-between px-2 pb-2 pt-1">
            <p className="text-[13px] font-semibold text-ink">Due revisions</p>
            <Link
              href="/revisions"
              onClick={close}
              className="text-[12px] font-medium text-accent-2 hover:underline"
            >
              View all
            </Link>
          </div>
          {!learnerId ? (
            <p className="px-2 pb-2 text-[13px] text-muted">Select a learner to see due reviews.</p>
          ) : error ? (
            <p className="px-2 pb-2 text-[13px] text-danger">{error}</p>
          ) : count === 0 ? (
            <p className="px-2 pb-2 text-[13px] text-muted">Nothing is due right now.</p>
          ) : (
            <ul className="max-h-72 space-y-0.5 overflow-auto scroll-quiet">
              {tasks.map((task) => (
                <li key={task.pattern_id}>
                  <Link
                    href={`/practice?pattern_id=${task.pattern_id}&problem_id=${task.problem_id}`}
                    onClick={close}
                    className="block rounded-lg px-2 py-2 transition-colors hover:bg-white/[0.04]"
                  >
                    <span className="block truncate text-[13px] font-medium text-ink">
                      {task.pattern_name}
                    </span>
                    <span className="block truncate text-[12px] text-muted">
                      {task.problem_title} · due {formatDate(task.due_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- Learner */

function LearnerMenu() {
  const learner = useLearner();
  const wrapRef = useRef<HTMLDivElement>(null);
  const { panelOpen, closePanel, openPanel } = learner;
  useDismiss(wrapRef, panelOpen, closePanel);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-label="Learner account"
        aria-expanded={panelOpen}
        onClick={() => (panelOpen ? closePanel() : openPanel())}
        className="focus-ring flex h-9 items-center gap-2 rounded-lg pl-1 pr-2 transition-colors hover:bg-white/[0.05]"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-2/15 text-[11px] font-semibold text-accent-2">
          {learner.learner ? initials(learner.learner.name) : <IconUser size={15} />}
        </span>
        <span className="hidden max-w-[9rem] truncate text-[13px] font-medium text-ink sm:block">
          {learner.learnerId ? learnerDisplayName(learner) : "Learner"}
        </span>
      </button>

      {/* Keyed on the learner ID so the ID field re-initialises when the learner changes. */}
      {panelOpen && <LearnerPanel key={learner.learnerId} />}
    </div>
  );
}

function LearnerPanel() {
  const learner = useLearner();
  const { closePanel } = learner;
  const [idInput, setIdInput] = useState(learner.learnerId);
  const [idError, setIdError] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createMessage, setCreateMessage] = useState("");

  function switchLearner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIdError("");
    const parsed = Number(idInput);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      setIdError("Enter a positive learner ID.");
      return;
    }
    learner.setLearnerId(String(parsed));
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creating) return;
    setCreateError("");
    setCreateMessage("");
    if (!name.trim() || !email.trim()) {
      setCreateError("Enter a name and an email address.");
      return;
    }
    setCreating(true);
    try {
      const user = await learner.createLearner(name, email);
      setCreateMessage(`Created learner #${user.id} for ${user.name}.`);
      setName("");
      setEmail("");
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Could not create the learner.");
    } finally {
      setCreating(false);
    }
  }

  const statusLine =
    learner.status === "loading"
      ? "Loading profile…"
      : learner.status === "missing"
        ? "No learner exists with this ID."
        : learner.status === "error"
          ? "Profile could not be loaded. Requests still use this ID."
          : learner.learner
            ? learner.learner.email
            : "No learner selected.";

  return (
    <div className="glass-pop absolute right-0 top-11 z-40 w-[20rem] rounded-xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold text-ink">
                {learner.learnerId ? learnerDisplayName(learner) : "Choose a learner"}
              </p>
              <p
                className={cx(
                  "mt-0.5 truncate text-[12px]",
                  learner.status === "missing" || learner.status === "error" ? "text-warning" : "text-muted",
                )}
              >
                {statusLine}
              </p>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={closePanel}
              className="focus-ring -mr-1 -mt-1 rounded-md p-1 text-faint hover:text-ink"
            >
              <IconClose size={16} />
            </button>
          </div>

          <form onSubmit={switchLearner} className="mt-4">
            <label className="block text-[12px] font-medium text-muted">
              Learner ID
              <div className="mt-1.5 flex gap-2">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={idInput}
                  onChange={(event) => setIdInput(event.target.value)}
                  placeholder="e.g. 1"
                  className="field"
                />
                <Button type="submit" variant="primary" className="shrink-0">
                  Use
                </Button>
              </div>
            </label>
            {idError && (
              <p role="alert" className="mt-1.5 text-[12px] text-danger">
                {idError}
              </p>
            )}
            <p className="mt-2 text-[11.5px] leading-4 text-faint">
              The ID is remembered in this browser and shared by every page.
            </p>
          </form>

          <div className="my-4 h-px bg-line-soft" />

          <form onSubmit={create} className="space-y-2">
            <p className="text-[12px] font-medium text-muted">New learner</p>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Name"
              autoComplete="name"
              className="field"
            />
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email"
              autoComplete="email"
              className="field"
            />
            {createError && (
              <p role="alert" className="text-[12px] text-danger">
                {createError}
              </p>
            )}
            {createMessage && (
              <p role="status" className="text-[12px] text-success">
                {createMessage}
              </p>
            )}
            <div className="flex items-center justify-between gap-2 pt-1">
              <Button type="submit" size="sm" disabled={creating}>
                {creating ? "Creating…" : "Create learner"}
              </Button>
              {learner.learnerId && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    learner.clearLearner();
                    setIdInput("");
                  }}
                >
                  Forget
                </Button>
              )}
            </div>
          </form>
    </div>
  );
}

/* ----------------------------------------------------------------- Shell */

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const title = PAGE_TITLES[pathname] ?? "CodeX";

  useEffect(() => {
    if (!drawerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [drawerOpen]);

  return (
    <div className="app-ambient min-h-screen text-ink">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[15rem] border-r border-line-soft bg-sidebar lg:block">
        <SidebarContent />
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
          />
          <aside className="absolute inset-y-0 left-0 w-[16rem] border-r border-line-soft bg-sidebar shadow-pop">
            <SidebarContent onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-h-screen flex-col lg:pl-[15rem]">
        <header className="sticky top-0 z-20 border-b border-line-soft bg-bg/80 backdrop-blur-md">
          <div className="mx-auto flex h-14 w-full max-w-[90rem] items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              aria-label="Open navigation"
              onClick={() => setDrawerOpen(true)}
              className="focus-ring -ml-1 flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-white/[0.05] hover:text-ink lg:hidden"
            >
              <IconMenu size={20} />
            </button>
            <p className="hidden text-[13px] font-medium text-muted md:block">
              <span className="text-faint">CodeX</span>
              <span className="mx-2 text-line">/</span>
              <span className="text-ink">{title}</span>
            </p>
            <div className="ml-auto flex flex-1 items-center justify-end gap-1.5 sm:gap-2">
              <ProblemSearch />
              <RevisionBell />
              <LearnerMenu />
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[90rem] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
