# CodeX

CodeX is a coding-practice and pattern-mastery app. Learners submit Python
or Java solutions; the backend runs them in an external **Judge0** sandbox,
stores the verdict, updates per-pattern mastery, records mistakes with
feedback, and recommends the next problem. Code is never executed inside the
FastAPI process, and the browser never decides a verdict.

Project deliverables: [final project report](docs/CodeX_Project_Report.md) and
[presentation outline](docs/CodeX_Presentation.md).

- Backend: FastAPI + SQLAlchemy (`backend/`)
- Frontend: Next.js 16 (`frontend/`)
- Database: PostgreSQL (via `docker-compose.yml`) or an isolated SQLite demo file
- Seed data: `data/patterns.json`, `data/problems.json`, `data/test_cases.json`

37 of the 50 seeded problems have verified console input/output test cases and
can be evaluated. The remaining 13 (tree, graph, and class-design problems) are
catalog entries only; the UI marks them "not evaluable" and recommendations
skip them.

## Quick start with an isolated demo database (PowerShell)

These steps never read or write the PostgreSQL database. The seed command
refuses to run against anything other than SQLite unless you pass `--confirm`.

### 1. Backend

```powershell
cd backend
if (!(Test-Path .\venv\Scripts\python.exe)) { python -m venv venv }
.\venv\Scripts\python.exe -m pip install -r requirements.txt

# Pick a NEW file name if codex-demo.sqlite3 already exists and you want a clean slate.
# --sqlite seeds that file directly; the database in .env is never opened.
.\venv\Scripts\python.exe -m app.seed --sqlite .\codex-demo.sqlite3

$env:DATABASE_URL = "sqlite:///./codex-demo.sqlite3"
$env:JUDGE0_URL = "https://ce.judge0.com" # set to "" only to disable evaluation
.\venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

The API is now at `http://127.0.0.1:8000` (interactive docs at `/docs`).
Environment variables set in the shell take precedence over `backend/.env`,
so the commands above are safe even if `.env` points at PostgreSQL. (Without
`--sqlite`, `python -m app.seed` seeds whatever `DATABASE_URL` points at, so
set the variable first.) SQLite files are git-ignored and created per
developer; a fresh seed always produces the same rows in the same order
(patterns in `patterns.json` order, problems in `problems.json` order).

### 2. Frontend (second terminal)

```powershell
cd frontend
if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }
npm ci
npm run dev
```

Open `http://localhost:3000` and click **Start practicing**. The Next.js
rewrite forwards `/api/backend/*` to `BACKEND_API_URL` (default
`http://127.0.0.1:8000`); nothing in the frontend bundle contains secrets.

### 3. Create a learner and submit

On the practice page, use **Need a learner ID?** to create a learner; the ID
is filled in and remembered in the browser. Or use the API:

```powershell
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/users/ -ContentType "application/json" -Body '{"name":"Learner","email":"learner@example.com"}'
Invoke-RestMethod http://127.0.0.1:8000/problems/ | Select-Object id, title, test_cases_available
```

Each evaluable problem's description states its stdin/stdout contract and the
page shows the visible sample cases. A Python solution for **Binary Search**
(`external_id` 704):

```python
import sys
data = sys.stdin.read().split()
n = int(data[0]); nums = list(map(int, data[1:1 + n])); target = int(data[1 + n])
lo, hi = 0, n - 1
while lo <= hi:
    mid = (lo + hi) // 2
    if nums[mid] == target:
        print(mid); break
    if nums[mid] < target: lo = mid + 1
    else: hi = mid - 1
else:
    print(-1)
```

Java submissions must define `public class Main` with a `main` method and read
from `System.in`.

On a freshly seeded database Binary Search has `id` 11; confirm with
`GET /problems/` before submitting.

```powershell
$body = @{ user_id = 1; problem_id = 11; language = "python"; code = "print(-1)" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/submissions/ -ContentType "application/json" -Body $body
```

The response contains the server verdict (`status`, `is_correct`),
`evaluation_details` (failed test number, judge diagnostics, your output,
feedback), the updated `mastery`, a `mistake` for incorrect results, and a
`recommendation`. Any `status` / `is_correct` fields sent by the client are
ignored.

## Learner progress

`GET /progress/?user_id=<learner-id>` returns persisted attempt totals,
correct attempts, and accuracy percentage, plus per-pattern mastery and
accuracy, the strongest and weakest attempted patterns, and the 10 most recent
submissions. Accuracy is a percentage from 0 to 100 rounded to two decimal
places. Pattern scores come from the learner's saved mastery records; attempt
counts and correctness are aggregated from submissions. A learner with no
attempts receives zero totals and accuracy, empty pattern and recent-submission
lists, and `null` strongest and weakest patterns. A nonpositive ID returns
HTTP 422 and an unknown learner returns HTTP 404.

The request must include one `user_id`; all returned data is scoped to that
learner. The endpoint does not return submitted source code or evaluation
details.

## Adaptive revisions

`GET /revisions/?user_id=<learner-id>` returns an array containing at most one
revision recommendation for each of the learner's patterns whose persisted
`next_revision_at` is due. Results are ordered by lowest mastery first, then
oldest due date. Weak patterns select the easiest evaluable associated problem;
developing patterns select the available difficulty closest to Medium; strong
patterns select the hardest evaluable problem. Every result includes the
pattern, mastery score, due date, selected problem, priority, and an
explanation. Problems without usable test cases are never selected. A valid
learner with no mastery records, no due revisions, or no evaluable problem for
their due patterns receives an empty array. A nonpositive ID returns HTTP 422
and an unknown learner returns HTTP 404.

The selection is a deterministic, rule-based MVP; it does not use machine
learning.

## Adaptive practice recommendations

`GET /recommendations/?user_id=<learner-id>` returns one deterministic
recommendation using saved pattern mastery and the learner's submission
history. Lower-mastery patterns are preferred; when mastery is missing, the
observed correctness rate is used to rank patterns. Low mastery selects an
easier problem, developing mastery targets a difficulty near the learner's
most recent attempt, and strong mastery selects a harder problem. Previously
attempted problems are skipped whenever an unattempted evaluable alternative
exists. Only problems with usable test cases are eligible, and the response
includes the selection reason. Learners without history start with the easiest
available unattempted problem; if no eligible problems exist, the endpoint
returns HTTP 404.

## MVP demo checklist

Use the isolated SQLite setup above, start the backend and frontend, then visit
`/practice` to create a learner. Submit a solution for a problem marked
evaluable with a real `JUDGE0_URL` configured; the demo setup leaves Judge0
disabled, so submissions correctly return 503 until a judge is configured.
After a saved attempt, visit `/dashboard` for analytics, `/recommendations` for
the next suggested problem, and `/revisions` for due review tasks. The learner
ID is shared between these pages and practice.

An empty revision list immediately after practice is expected: the current
mastery scheduler sets the first revision at least one day later. The automated
cross-module journey test makes an attempt's saved date due in its isolated
in-memory database and mocks the judge and feedback; it does not call Judge0,
an AI provider, or PostgreSQL.

## Judge0 configuration

Without a judge the API returns HTTP 503 for every submission and saves
nothing. To enable evaluation, set in `backend/.env` (or the shell):

| Variable | Meaning |
| --- | --- |
| `JUDGE0_URL` | Base URL of a Judge0 CE instance, e.g. `https://ce.judge0.com` or your own |
| `JUDGE0_API_KEY` | Optional. Sent as `X-Auth-Token`; for `*.rapidapi.com` hosts it is sent as `X-RapidAPI-Key` automatically |
| `JUDGE0_AUTH_HEADER` | Optional override for the header name |
| `JUDGE0_TIMEOUT_SECONDS` | Per-request timeout (default 15) |
| `JUDGE0_EVALUATION_TIMEOUT_SECONDS` | Budget for all test cases of one submission (default 90; the public CE queue can be delayed) |

Submissions are created with `wait=false` and polled by token. Language IDs:
Python `71`, Java `62`. Source is limited to 50,000 bytes, inputs to 10,000
bytes, and 50 test cases per problem. Output comparison ignores trailing
whitespace and Windows line endings.

Test cases live in `data/test_cases.json`, keyed by the problem's
`external_id`, each shaped `{"input": "...", "expected_output": "...", "visible": true|false}`.
Only `visible` cases are sent to the browser. Every expected output is checked
by `backend/tests/test_seed_data.py` against the reference solutions in
`backend/tests/reference_solutions.py`.

The backend does not seed test cases automatically at startup. If an existing
PostgreSQL database has problems with missing test cases, run the additive
seeder from `backend` after confirming `DATABASE_URL` points to the intended
database:

```powershell
.\venv\Scripts\python.exe -m app.seed --confirm
```

This creates missing catalog rows and fills test cases only for existing rows
that have none; it does not overwrite configured cases or delete data. Of the
50 catalog problems, the 37 with verified console-I/O contracts become
evaluable. The remaining 13 intentionally stay not evaluable.

## Optional AI feedback

Feedback is generated after Judge0 has produced a verdict. Without AI
configuration, CodeX uses built-in rule-based feedback. With it, the backend
calls an OpenAI-compatible **chat completions** API (`POST .../chat/completions`,
`Authorization: Bearer <key>`, `response_format: {"type": "json_object"}`,
`max_tokens: 700`) and reads `choices[0].message.content`.

| Variable | Meaning |
| --- | --- |
| `AI_API_URL` | Base URL such as `https://api.openai.com/v1` (the backend appends `/chat/completions`) or the full `.../chat/completions` endpoint |
| `AI_API_KEY` | Provider API key. Backend only; never a `NEXT_PUBLIC_` variable |
| `AI_MODEL` | Model id offered by that provider (default `gpt-4o-mini`, an OpenAI model) |
| `AI_TIMEOUT_SECONDS` | Provider request timeout (default 8) |
| `AI_MAX_TOKENS` | Optional output token limit (default 700). Thinking models count reasoning tokens against it |
| `AI_REASONING_EFFORT` | Optional `reasoning_effort` (e.g. `low`); sent only when set, because non-reasoning models such as `gpt-4o-mini` reject it |

AI is enabled only when both `AI_API_URL` and `AI_API_KEY` are non-empty. Any
provider that offers an OpenAI-compatible chat completions endpoint with JSON
mode can be used by setting its base URL and one of its model ids. Models that
reject a parameter return an error, and CodeX then falls back to rule-based
feedback with the reason.

**Google Gemini** (verified live on 2026-10-22 with a free-tier key: probe and
five real submissions returned `ai_generated`):

```
AI_API_URL=https://generativelanguage.googleapis.com/v1beta/openai/
AI_MODEL=gemini-3.5-flash-lite
AI_API_KEY=<key from https://aistudio.google.com/apikey>
```

Use a current model id from https://ai.google.dev/gemini-api/docs/models.
Gemini 2.5 models return `HTTP 404 NOT_FOUND ... no longer available to new users`
for new projects, and `gemini-4-argon` has no free tier. Gemini 3 models always
think; if the fallback reason says the reply stopped at the `AI_MAX_TOKENS`
limit, raise `AI_MAX_TOKENS` or set `AI_REASONING_EFFORT=low`.

### Configure a provider (PowerShell)

Either keep the key for the current shell only (nothing is written to disk),
then start the API from that same shell:

```powershell
cd backend
$env:AI_API_URL = "https://api.openai.com/v1"
$env:AI_MODEL = "gpt-4o-mini"
$env:AI_API_KEY = [System.Net.NetworkCredential]::new("", (Read-Host "AI API key" -AsSecureString)).Password
.\venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Or persist it in the git-ignored `backend/.env` (first remove any existing
`AI_` lines so each variable appears once):

```powershell
cd backend
$key = [System.Net.NetworkCredential]::new("", (Read-Host "AI API key" -AsSecureString)).Password
Add-Content -Path .env -Encoding utf8 -Value "", "AI_API_URL=https://api.openai.com/v1", "AI_MODEL=gpt-4o-mini", "AI_TIMEOUT_SECONDS=8", "AI_API_KEY=$key"
Remove-Variable key
Select-String -Path .env -Pattern '^AI_' | ForEach-Object { $_.Line -replace '^(AI_API_KEY=).+', '$1<set>' }
```

The backend loads `backend/.env` by its absolute path (from any working
directory) **once, at startup**. `--reload` watches `.py` files, not `.env`,
so after saving `.env` stop uvicorn (Ctrl+C) and start it again. Variables
already set in the shell take precedence over `backend/.env`, so
`$env:AI_API_KEY = ""` disables AI for that shell, and a stale `$env:` value
hides the file's value until you run `Remove-Item Env:AI_API_KEY`. Unit
tests set `CODEX_SKIP_DOTENV=1` and never read `backend/.env`.

### What the provider receives and returns

The backend sends the problem title and description, language, submitted code
(first 12,000 characters), Judge0 verdict, compiler/runtime diagnostic, actual
output, and (when present) the failed test's input and expected output
(each limited to 2,000 characters). The failed case is used only in this
backend request and is not added to the browser response. The provider must
return a JSON object with non-empty string fields `explanation`, `hint`, and
`correction`, which may be wrapped in a Markdown code fence. CodeX trims these
fields to 1,000, 500, and 1,000 characters and rejects provider responses
larger than 64 KB.

Only Judge0 determines `status` and `is_correct`; AI feedback cannot change
acceptance, persistence, mastery, mistake tracking, or recommendations. A reply
that names a verdict different from Judge0's is rejected. If the provider fails
for any reason (401/403, 429, 5xx, timeout, empty or malformed content, missing
fields), the submission is still saved with rule-based feedback, and the
backend logs one warning that gives the reason without any secret, e.g.
`AI feedback unavailable (provider rejected the credentials (HTTP 401)); using rule-based feedback`.

### Telling AI feedback from the fallback

| Where | AI feedback active | Rule-based fallback |
| --- | --- | --- |
| API `evaluation_details.feedback.provider` | `ai_generated` | `rule_based` |
| Practice / mistakes result panel | **AI-generated feedback** + "Advisory" badge | **Rule-based feedback** + "Fallback" badge |
| API `evaluation_details.feedback.fallback_reason` | absent | sanitized reason, also shown under the panel ("AI feedback was unavailable: …") |
| Backend log | `INFO: app.services.feedback: AI feedback generated by <model>` | `AI feedback unavailable (<reason>)`, or `AI disabled: … not set in the backend process` once at the first submission |

`GET /health/ai` shows the settings **as the running backend process sees
them** (whether AI is enabled, any missing variables, the resolved endpoint, and
the model; never the key). `GET /health/ai?probe=true` also makes one small,
billable provider request and returns its sanitized result. Variables set with
`$env:` exist only in that PowerShell window, so start uvicorn from the same
window, and restart it after changing them (`--reload` does not reread the
environment).

| `fallback_reason` contains | Fix |
| --- | --- |
| `AI disabled: AI_API_KEY ... not set in the backend process` | The backend never received the variable; set it in the window that starts uvicorn, or in `backend/.env` |
| `rejected the API key (HTTP 401 invalid_api_key)` | The key is wrong, revoked, or incomplete; create a new key and restart the backend |
| `insufficient credits or quota (HTTP 429 insufficient_quota)` | Add billing or credits to the provider account |
| `rate limit reached (HTTP 429 ...)` | Wait and retry (credit problems such as `credit_balance_exhausted` are reported as insufficient credits instead) |
| `model '...' was not found (HTTP 404 model_not_found)` | Set `AI_MODEL` to a model your key can use |
| `could not reach the provider` / `timed out` | Check `AI_API_URL`, network/proxy, or raise `AI_TIMEOUT_SECONDS` |

Rule-based text is fixed per verdict (e.g. "Your output differed from the
expected result on test N."). AI text refers to your specific code and output.
To confirm AI is working live, start the API with AI configured, then run the live
check (five real Judge0 runs and five billable provider requests):

```powershell
.\venv\Scripts\python.exe scripts\live_judge0_check.py --api http://127.0.0.1:8000 --expect-feedback ai_generated
```

The automated tests mock the provider. They check request building, parsing,
and fallback behaviour, but they do **not** prove that a real provider works.
Only a live run that returns `ai_generated` does that.

## Using PostgreSQL instead

```powershell
docker compose up -d        # postgres on host port 5433
cd backend
Copy-Item .env.example .env # then edit DATABASE_URL etc.
.\venv\Scripts\python.exe -m app.seed --confirm
.\venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Startup runs `create_all` and adds the `problems.test_cases` and
`submissions.evaluation_details` JSON columns to older databases. There is no
migration framework. Seeding is idempotent: existing patterns and problems are
untouched, and test cases are only added to problems that have none. Before
writing anything, the seed command cross-checks the three JSON files (unknown
or duplicate patterns, duplicate problems, test-case entries for unknown
problems, malformed or hidden-only cases) and exits with status 2 if they are
inconsistent, leaving the database untouched.

## Verification

```powershell
cd backend
.\venv\Scripts\python.exe -m unittest discover -s tests -v
```

```powershell
cd frontend
npm run lint
npm run build
```

| Check | Uses live services? |
| --- | --- |
| Backend unit tests (137) | No. Judge0 and the AI provider are mocked; databases are in-memory SQLite or throwaway temp files |
| Frontend lint / build | No |
| `backend/scripts/live_judge0_check.py` | **Yes.** Contacts the configured judge, and the AI provider when the API has one configured, through the running API. `--expect-feedback ai_generated\|rule_based` asserts the feedback source. See `docs/live-judge0-test-plan.md`; run only when you approve live testing |

## Interpreting common errors

| Response | Meaning |
| --- | --- |
| `503 Evaluation is unavailable: configure JUDGE0_URL` | No judge configured; nothing was saved |
| `503 ... this problem has no configured test cases` / `... misconfigured` | Problem cannot be evaluated; nothing was saved |
| `502 Evaluation Error: ... rejected the configured credentials` | Judge returned 401; check the key and header type |
| `502 Evaluation Error: ... refused the request (HTTP 403)` | Bad key or header type, or a CDN in front of the judge (e.g. Cloudflare) blocked the request |
| `502 Evaluation Error: ... rate limiting` | Judge returned 429 |
| `502 Evaluation Error: ... did not return a result before the evaluation timeout` | Judge queue too slow for the configured budget |
| `422 Supported languages are python and java` | Unsupported language |
| `404 User not found` / `Problem not found` | Bad IDs |
| Frontend: "The request timed out before the judge finished" | 130 s client timeout; the backend may still have saved the attempt, so wait before retrying |

## Security notes

There is no authentication layer. `user_id` is supplied by the client and
trusted, and the list endpoints (`/submissions/`, `/mastery/`, `/mistakes/`)
accept an optional `user_id` filter but are not access-controlled. `/progress/`
requires a `user_id`, but is likewise not access-controlled. This is acceptable
for a local demo only; put the API behind authentication before exposing it.
Keep all keys in `backend/.env`, which is git-ignored.

## Project layout

```
backend/app/routes        FastAPI routers (users, patterns, problems, submissions, mistakes, mastery, recommendations, progress, revisions)
backend/app/services      evaluator (Judge0), feedback, mastery, mistake, recommendation
backend/app/seed.py       validated, idempotent seeding; --sqlite PATH for isolated demo files
backend/tests             unittest suite (mocked judge/AI) + reference solutions
backend/scripts           live_judge0_check.py (manual, live)
data/                     patterns, problems, verified test cases
frontend/app/practice     practice page and API client
docs/                     live Judge0 test plan
```
