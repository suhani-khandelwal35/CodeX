import { LEARNER_STORAGE_KEY } from "../practice/api";

export const PRACTICE_PREFILL_KEY = "codex.practice.prefill";

export interface PracticePrefill {
  problemId: number;
  language: string;
  code: string;
}

export function readStoredLearnerId(): string {
  try {
    return window.localStorage.getItem(LEARNER_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function storeLearnerId(value: string) {
  try {
    if (value) window.localStorage.setItem(LEARNER_STORAGE_KEY, value);
    else window.localStorage.removeItem(LEARNER_STORAGE_KEY);
  } catch {
    // Storage can be unavailable in private windows; the app still works for the session.
  }
}

export function storePracticePrefill(prefill: PracticePrefill) {
  try {
    window.sessionStorage.setItem(PRACTICE_PREFILL_KEY, JSON.stringify(prefill));
  } catch {
    // Without session storage the problem still opens; only the code prefill is lost.
  }
}

/** Reads and clears a one-shot prefill written by the mistake review page. */
export function takePracticePrefill(): PracticePrefill | null {
  try {
    const raw = window.sessionStorage.getItem(PRACTICE_PREFILL_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(PRACTICE_PREFILL_KEY);
    const parsed = JSON.parse(raw) as Partial<PracticePrefill>;
    if (
      typeof parsed.problemId !== "number" ||
      typeof parsed.code !== "string" ||
      typeof parsed.language !== "string"
    ) {
      return null;
    }
    return { problemId: parsed.problemId, code: parsed.code, language: parsed.language };
  } catch {
    return null;
  }
}
