"use client";

import { useCallback, useId, useMemo, useRef, type KeyboardEvent, type ReactNode } from "react";

import { cx } from "./ui";

type TokenClass = "kw" | "str" | "num" | "cmt" | "fn" | "type" | "op" | "deco" | null;

interface Token {
  text: string;
  cls: TokenClass;
}

const PYTHON_KEYWORDS = new Set(
  "False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case".split(
    " ",
  ),
);
const PYTHON_BUILTINS = new Set(
  "print input int str float list dict set tuple len range enumerate zip map filter sorted sum min max abs sys math collections itertools heapq bisect deque defaultdict Counter open isinstance type self cls".split(
    " ",
  ),
);
const JAVA_KEYWORDS = new Set(
  "abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while var record yield sealed permits true false null".split(
    " ",
  ),
);
const JAVA_TYPES = new Set(
  "String Integer Long Double Boolean Character Math System Scanner BufferedReader InputStreamReader StringBuilder List ArrayList Map HashMap Set HashSet Deque ArrayDeque Arrays Collections Queue LinkedList PriorityQueue Object Exception IOException".split(
    " ",
  ),
);

const PATTERN = new RegExp(
  [
    String.raw`(?<cmt>#[^\n]*|//[^\n]*|/\*[\s\S]*?\*/)`,
    String.raw`(?<str>"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')`,
    String.raw`(?<num>\b\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?[lLfFdDjJ]?\b)`,
    String.raw`(?<deco>@[A-Za-z_]\w*)`,
    String.raw`(?<id>[A-Za-z_]\w*)`,
    String.raw`(?<op>[+\-*/%=<>!&|^~?:]+)`,
    String.raw`(?<ws>\s+)`,
    String.raw`(?<other>[\s\S])`,
  ].join("|"),
  "g",
);

function tokenize(source: string, language: string): Token[] {
  const isJava = language === "java";
  const keywords = isJava ? JAVA_KEYWORDS : PYTHON_KEYWORDS;
  const types = isJava ? JAVA_TYPES : PYTHON_BUILTINS;
  const tokens: Token[] = [];
  PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = PATTERN.exec(source)) !== null) {
    const groups = match.groups ?? {};
    const text = match[0];
    if (groups.cmt !== undefined) {
      // Python has no // comments and Java has no # comments; keep the wrong one plain.
      const isHash = text.startsWith("#");
      tokens.push({ text, cls: isHash === !isJava ? "cmt" : null });
    } else if (groups.str !== undefined) {
      tokens.push({ text, cls: "str" });
    } else if (groups.num !== undefined) {
      tokens.push({ text, cls: "num" });
    } else if (groups.deco !== undefined) {
      tokens.push({ text, cls: "deco" });
    } else if (groups.id !== undefined) {
      let cls: TokenClass = null;
      if (keywords.has(text)) cls = "kw";
      else if (types.has(text)) cls = "type";
      else {
        const next = source.slice(PATTERN.lastIndex).match(/^\s*\(/);
        if (next) cls = "fn";
      }
      tokens.push({ text, cls });
    } else if (groups.op !== undefined) {
      tokens.push({ text, cls: "op" });
    } else {
      tokens.push({ text, cls: null });
    }
  }
  return tokens;
}

function renderTokens(tokens: Token[]): ReactNode[] {
  const out: ReactNode[] = [];
  let buffer = "";
  let bufferClass: TokenClass = null;
  let key = 0;
  const flush = () => {
    if (!buffer) return;
    out.push(
      bufferClass ? (
        <span key={key++} className={`tok-${bufferClass}`}>
          {buffer}
        </span>
      ) : (
        <span key={key++}>{buffer}</span>
      ),
    );
    buffer = "";
  };
  for (const token of tokens) {
    if (token.cls !== bufferClass) {
      flush();
      bufferClass = token.cls;
    }
    buffer += token.text;
  }
  flush();
  return out;
}

/** Read-only highlighted listing used by the mistake review page. */
export function HighlightedCode({
  code,
  language,
  maxHeight = "28rem",
  className,
}: {
  code: string;
  language: string;
  maxHeight?: string;
  className?: string;
}) {
  const highlighted = useMemo(() => renderTokens(tokenize(code, language)), [code, language]);
  const lines = code.split("\n").length;
  return (
    <div
      className={cx(
        "scroll-quiet flex overflow-auto rounded-xl border border-line-soft bg-surface-sunken",
        className,
      )}
      style={{ maxHeight }}
    >
      <div
        aria-hidden
        className="editor-text sticky left-0 select-none border-r border-line-soft bg-surface-sunken px-3 py-3 text-right text-faint"
      >
        {Array.from({ length: lines }, (_, index) => (
          <div key={index}>{index + 1}</div>
        ))}
      </div>
      <pre className="editor-text m-0 flex-1 px-4 py-3 text-ink">{highlighted}</pre>
    </div>
  );
}

export function CodeEditor({
  value,
  onChange,
  language,
  placeholder,
  disabled,
  minLines = 16,
  label = "Solution code",
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  language: string;
  placeholder?: string;
  disabled?: boolean;
  minLines?: number;
  label?: string;
  className?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const id = useId();

  const highlighted = useMemo(() => renderTokens(tokenize(value, language)), [value, language]);
  const lineCount = Math.max(minLines, value.split("\n").length);
  const lineNumbers = useMemo(
    () => Array.from({ length: lineCount }, (_, index) => index + 1),
    [lineCount],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      const textarea = event.currentTarget;
      const { selectionStart, selectionEnd } = textarea;

      if (event.key === "Tab" && !event.shiftKey) {
        event.preventDefault();
        const insert = "    ";
        const next = value.slice(0, selectionStart) + insert + value.slice(selectionEnd);
        onChange(next);
        requestAnimationFrame(() => {
          textarea.selectionStart = textarea.selectionEnd = selectionStart + insert.length;
        });
        return;
      }

      if (event.key === "Enter" && !event.shiftKey && !event.metaKey && !event.ctrlKey) {
        const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
        const currentLine = value.slice(lineStart, selectionStart);
        const indent = currentLine.match(/^[ \t]*/)?.[0] ?? "";
        const trimmed = currentLine.trimEnd();
        const opensBlock =
          (language === "python" && trimmed.endsWith(":")) ||
          (language === "java" && trimmed.endsWith("{"));
        const extra = opensBlock ? "    " : "";
        event.preventDefault();
        const insert = `\n${indent}${extra}`;
        const next = value.slice(0, selectionStart) + insert + value.slice(selectionEnd);
        onChange(next);
        requestAnimationFrame(() => {
          textarea.selectionStart = textarea.selectionEnd = selectionStart + insert.length;
        });
      }
    },
    [language, onChange, value],
  );

  return (
    <div
      className={cx(
        "scroll-quiet relative flex overflow-auto rounded-xl border border-line bg-surface-sunken transition-colors focus-within:border-accent/70",
        disabled && "opacity-70",
        className,
      )}
      style={{ minHeight: `calc(${lineCount} * 13px * 1.6 + 2rem)` }}
    >
      <div
        aria-hidden
        className="editor-text sticky left-0 z-10 select-none border-r border-line-soft bg-surface-sunken px-3 py-4 text-right text-faint"
      >
        {lineNumbers.map((n) => (
          <div key={n}>{n}</div>
        ))}
      </div>
      <div className="relative min-w-0 flex-1">
        <pre aria-hidden className="editor-text pointer-events-none m-0 min-h-full px-4 py-4 text-ink">
          {value ? highlighted : <span className="text-faint">{placeholder}</span>}
          {"\n"}
        </pre>
        <textarea
          ref={textareaRef}
          id={id}
          aria-label={label}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          wrap="off"
          className="editor-text absolute inset-0 h-full w-full resize-none overflow-hidden bg-transparent px-4 py-4 text-transparent caret-accent-2 outline-none selection:bg-accent/25"
        />
      </div>
    </div>
  );
}
