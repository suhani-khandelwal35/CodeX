"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { apiRequest, type User } from "../practice/api";
import { readStoredLearnerId, storeLearnerId } from "../lib/storage";

export type LearnerStatus = "none" | "loading" | "ready" | "missing" | "error";

interface LearnerContextValue {
  /** Current learner ID as a string; empty when no learner is selected. */
  learnerId: string;
  /** Profile from GET /users/{id}; null until loaded or when unknown. */
  learner: User | null;
  status: LearnerStatus;
  /** True once localStorage has been read on the client. */
  hydrated: boolean;
  setLearnerId: (id: string) => void;
  clearLearner: () => void;
  createLearner: (name: string, email: string) => Promise<User>;
  panelOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;
}

const LearnerContext = createContext<LearnerContextValue | null>(null);

export function LearnerProvider({ children }: { children: ReactNode }) {
  const [learnerId, setLearnerIdState] = useState("");
  const [learner, setLearner] = useState<User | null>(null);
  const [status, setStatus] = useState<LearnerStatus>("none");
  const [hydrated, setHydrated] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function restore() {
      // Read after a microtask so the effect body never sets state synchronously.
      const saved = await Promise.resolve(readStoredLearnerId());
      if (cancelled) return;
      if (saved) setLearnerIdState(saved);
      setHydrated(true);
    }
    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function syncProfile() {
      if (!learnerId) {
        setLearner(null);
        setStatus("none");
        return;
      }
      setStatus("loading");
      try {
        const user = await apiRequest<User>(`/users/${encodeURIComponent(learnerId)}`);
        if (cancelled) return;
        setLearner(user);
        setStatus("ready");
      } catch (error) {
        if (cancelled) return;
        setLearner(null);
        const message = error instanceof Error ? error.message : "";
        setStatus(message === "User not found" ? "missing" : "error");
      }
    }

    void syncProfile();
    return () => {
      cancelled = true;
    };
  }, [learnerId]);

  const setLearnerId = useCallback((id: string) => {
    const normalized = id.trim();
    setLearnerIdState(normalized);
    storeLearnerId(normalized);
  }, []);

  const clearLearner = useCallback(() => {
    setLearnerIdState("");
    storeLearnerId("");
  }, []);

  const createLearner = useCallback(
    async (name: string, email: string) => {
      const user = await apiRequest<User>("/users/", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      });
      setLearnerId(String(user.id));
      return user;
    },
    [setLearnerId],
  );

  const openPanel = useCallback(() => setPanelOpen(true), []);
  const closePanel = useCallback(() => setPanelOpen(false), []);

  const value = useMemo<LearnerContextValue>(
    () => ({
      learnerId,
      learner,
      status,
      hydrated,
      setLearnerId,
      clearLearner,
      createLearner,
      panelOpen,
      openPanel,
      closePanel,
    }),
    [
      learnerId,
      learner,
      status,
      hydrated,
      setLearnerId,
      clearLearner,
      createLearner,
      panelOpen,
      openPanel,
      closePanel,
    ],
  );

  return <LearnerContext.Provider value={value}>{children}</LearnerContext.Provider>;
}

export function useLearner(): LearnerContextValue {
  const context = useContext(LearnerContext);
  if (!context) {
    throw new Error("useLearner must be used inside LearnerProvider");
  }
  return context;
}

/** Display name for headings: the saved name, or "Learner #id" when the profile is unknown. */
export function learnerDisplayName(value: Pick<LearnerContextValue, "learner" | "learnerId">): string {
  if (value.learner?.name) return value.learner.name;
  if (value.learnerId) return `Learner #${value.learnerId}`;
  return "there";
}
