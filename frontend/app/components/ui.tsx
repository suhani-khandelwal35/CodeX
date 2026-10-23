import Link from "next/link";
import type { ComponentProps, ElementType, ReactNode } from "react";

import { clampPercent } from "../lib/format";
import { IconAlert } from "./icons";

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export { cx };

/* ---------------------------------------------------------------- Panels */

export function Panel({
  children,
  className,
  as: Tag = "section",
  ...rest
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article" | "aside" | "li";
} & Pick<ComponentProps<"div">, "role" | "aria-label" | "aria-live" | "style" | "id">) {
  const Element: ElementType = Tag;
  return (
    <Element className={cx("glass rounded-panel", className)} {...rest}>
      {children}
    </Element>
  );
}

export function PanelHeader({
  title,
  description,
  action,
  compact,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={cx(
        "flex flex-wrap items-start justify-between gap-3",
        compact ? "mb-3" : "mb-4",
      )}
    >
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cx("text-[11px] font-semibold uppercase tracking-[0.14em] text-muted", className)}>
      {children}
    </p>
  );
}

/* --------------------------------------------------------------- Buttons */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

const buttonBase =
  "focus-ring inline-flex items-center justify-center gap-2 rounded-[10px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-[#1a0f21] hover:bg-accent-2 shadow-[0_8px_20px_-12px_rgb(199_140_224/0.8)]",
  secondary:
    "border border-line bg-surface-raised text-ink hover:border-[#4a4250] hover:bg-[#28242d]",
  ghost: "text-muted hover:bg-surface-raised hover:text-ink",
  danger: "border border-danger/40 bg-danger/10 text-danger hover:bg-danger/15",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4 text-sm",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...rest
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      type="button"
      className={cx(buttonBase, buttonVariants[variant], buttonSizes[size], className)}
      {...rest}
    />
  );
}

export function LinkButton({
  variant = "secondary",
  size = "md",
  className,
  ...rest
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <Link
      className={cx(buttonBase, buttonVariants[variant], buttonSizes[size], className)}
      {...rest}
    />
  );
}

/* ---------------------------------------------------------------- Badges */

export type Tone = "neutral" | "accent" | "success" | "danger" | "warning";

const toneClasses: Record<Tone, string> = {
  neutral: "border-line bg-surface-raised text-muted",
  accent: "border-accent/30 bg-accent/10 text-accent-2",
  success: "border-success/30 bg-success/10 text-success",
  danger: "border-danger/30 bg-danger/10 text-danger",
  warning: "border-warning/30 bg-warning/10 text-warning",
};

export function Badge({
  tone = "neutral",
  children,
  className,
  dot,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cx(
        "inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-[11.5px] font-medium leading-none whitespace-nowrap",
        toneClasses[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

export function difficultyTone(difficulty: string): Tone {
  const key = difficulty.trim().toLowerCase();
  if (key === "easy") return "success";
  if (key === "medium") return "warning";
  if (key === "hard") return "danger";
  return "neutral";
}

export function verdictTone(status: string, isCorrect: boolean): Tone {
  if (isCorrect) return "success";
  const key = status.toLowerCase();
  if (key.includes("compilation")) return "warning";
  return "danger";
}

export function masteryTone(score: number): Tone {
  if (score < 40) return "danger";
  if (score <= 70) return "warning";
  return "success";
}

/* --------------------------------------------------------------- Figures */

export function StatTile({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
}) {
  return (
    <Panel as="div" className="flex items-start gap-3 p-4">
      {icon && (
        <span
          className={cx(
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
            toneClasses[tone],
          )}
        >
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <p className="text-[12.5px] font-medium text-muted">{label}</p>
        <p className="mt-1 text-[26px] font-semibold leading-none tracking-tight text-ink">
          {value}
        </p>
        {hint && <p className="mt-1.5 text-[12px] text-faint">{hint}</p>}
      </div>
    </Panel>
  );
}

const meterFill: Record<Tone, string> = {
  neutral: "bg-muted",
  accent: "bg-accent",
  success: "bg-success",
  danger: "bg-danger",
  warning: "bg-warning",
};

export function Meter({
  value,
  tone = "accent",
  label,
  className,
}: {
  value: number;
  tone?: Tone;
  label: string;
  className?: string;
}) {
  const pct = clampPercent(value);
  return (
    <div
      className={cx("h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken", className)}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
    >
      <div
        className={cx("h-full rounded-full transition-[width] duration-500", meterFill[tone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/* ----------------------------------------------------------------- States */

export function LoadingPanel({ lines = 3, label = "Loading" }: { lines?: number; label?: string }) {
  return (
    <Panel as="div" className="p-5" role="status" aria-live="polite">
      <span className="sr-only">{label}…</span>
      <div className="space-y-3" aria-hidden>
        <div className="skeleton h-4 w-1/3" />
        {Array.from({ length: lines }).map((_, index) => (
          <div key={index} className="skeleton h-3" style={{ width: `${88 - index * 14}%` }} />
        ))}
      </div>
    </Panel>
  );
}

export function EmptyState({
  title,
  body,
  action,
  icon,
  compact,
}: {
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={cx(
        "flex flex-col items-start rounded-xl border border-dashed border-line bg-surface-sunken/60",
        compact ? "p-4" : "p-6",
      )}
    >
      {icon && <span className="mb-3 text-accent">{icon}</span>}
      <p className="text-sm font-semibold text-ink">{title}</p>
      {body && <p className="mt-1 max-w-prose text-[13px] leading-5 text-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title,
  message,
  hint,
  action,
}: {
  title: string;
  message: string;
  hint?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/[0.07] p-4"
    >
      <span className="mt-0.5 text-danger">
        <IconAlert size={18} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="mt-1 text-[13px] leading-5 text-muted">{message}</p>
        {hint && <p className="mt-1 text-[12px] leading-5 text-faint">{hint}</p>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}

export function InlineNotice({
  tone = "warning",
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <p className={cx("rounded-lg border px-3 py-2 text-[13px] leading-5", toneClasses[tone])}>
      {children}
    </p>
  );
}

/* ------------------------------------------------------------------- Misc */

export function CodeBlock({
  children,
  className,
  maxHeight = "15rem",
}: {
  children: ReactNode;
  className?: string;
  maxHeight?: string;
}) {
  return (
    <pre
      className={cx(
        "scroll-quiet overflow-auto rounded-lg border border-line-soft bg-surface-sunken p-3 font-mono text-[12px] leading-5 text-ink whitespace-pre-wrap",
        className,
      )}
      style={{ maxHeight }}
    >
      {children}
    </pre>
  );
}

export function KeyValue({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[13px]">
      <span className="text-muted">{label}</span>
      <span className="text-right font-medium tabular-nums text-ink">{value}</span>
    </div>
  );
}
