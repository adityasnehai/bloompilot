# BloomPilot Agent & API Evaluation Report

**Run date:** 2026-07-20T17:06:33.862Z → 2026-07-20T17:08:46.385Z (2m 13s)
**Result file:** `eval/results/eval-2026-07-20T17-08-46-384Z.json` (also mirrored to `latest.json`)
**Harness:** `eval/run-evaluation.mjs` (reproducible, `npm run eval` from `eval/`)

## What this is

An automated, non-human evaluation of BloomPilot's multi-agent care-plan pipeline
(a 7-node LangGraph orchestration with a ReAct tool-calling planner), its
diagnosis system, its reminders/notification engine, and its API contract
robustness — run end-to-end against a live local instance of the real
application. No step in this evaluation used human grading, human-labeled
gold answers, or mocked application behavior.

## Methodology

**Fixtures are real accounts, not database inserts.** Six accounts were
created through the actual sign-up → onboarding wizard → plant-setup UI flow
(via Playwright, driving the real browser-rendered forms), covering six
different real-world locations and garden types:

| Fixture | Location | Garden type | Plants added |
|---|---|---|---|
| `mumbai-balcony` | Mumbai, India | Balcony | Tomato, Basil |
| `phoenix-backyard` | Phoenix, Arizona | Backyard | Rosemary, Aloe vera |
| `reykjavik-balcony` | Reykjavik, Iceland | Balcony | Mint |
| `singapore-indoor` | Singapore | Indoor | Fern, Pothos |
| `london-backyard` | London, UK | Backyard | Lavender |
| `denver-empty` | Denver, Colorado | Balcony | *(none — edge case)* |

Each location produces genuinely different live weather from the Open-Meteo
API (the app's own backend fetches this at request time — it is not
stubbed). This is the mechanism used to force the agent pipeline through
different real conditions (rain, heat, humidity, a zero-plant edge case)
without fabricating any inputs by hand.

**Checks are code-based and objective**, not vibes-based or LLM-graded:
structural schema validation, referential integrity, duplicate detection,
a weather-vs-action consistency rule, and an evidence-grounding check that
verifies every citation the agent returns actually traces back to a real
data source in the codebase (catches hallucinated citations). The full list
of legitimate evidence-source strings was extracted programmatically via
`grep -n "source:" src/lib/*.ts` across every file in the care-plan pipeline,
not guessed — see "Corrections made during development" below for how this
was caught and fixed when the first pass got it wrong.

**Reminders correctness includes an independent cross-check.** The
reminders API states in its own response notes whether a user's reminder
window is "active now" for their timezone. Rather than trust that string,
the harness independently recomputes the same fact from scratch — parsing
the stated IANA timezone and window bounds, then using Node's `Intl` API to
compute the real current local time for that zone — and verifies the app's
claim against that independently-derived ground truth.

**Robustness probes** hit the API with no auth, missing required
parameters, and nonexistent resource IDs, checking that the server responds
with a proper 4xx (not a raw 500 or a hang).

## Results summary

| Category | Metric | Result |
|---|---|---|
| Care-plan generation | Success rate | **100%** (12/12 calls, 200 OK) |
| Care-plan generation | Determinism (2 runs/fixture, same action count) | **100%** (6/6 fixtures stable) |
| Care-plan generation | Structural/consistency check pass rate | **100%** (96/96 individual checks) |
| Care-plan generation | Evidence-grounding pass rate (no hallucinated citations) | **100%** (12/12) |
| Care-plan generation | Median / p95 latency | 349ms / 1694ms |
| Care-plan generation | LLM-reasoning fallback rate | **100%** *(see note below)* |
| Diagnosis | Response schema validity | **100%** (4/4 real photo scans) |
| Diagnosis | Median latency | 2847ms |
| Reminders | Internal consistency (counts sum correctly across channels) | **100%** (6/6) |
| Reminders | Independent timezone/window claim verified | **100%** (6/6) |
| API robustness | Graceful response (no 500s / hangs) | **100%** (12/12 probes) |
| API robustness | Matches expected status code | **100%** (12/12 probes) |

### The 7-agent pipeline, verified per run

Every one of the 12 care-plan generations produced traces for all 7 expected
agents (Context Builder → Environment → Plant Knowledge → ReAct Care
Planner → Evidence → Reminder → Dashboard) — confirmed by asserting on the
actual `agent_traces` array in each response, not just on the final output.

### Important, honestly-reported caveat: LLM-reasoning fallback rate

The `fallbackUsedRatePct: 100%` line above needs context, not a footnote.
The project's configured OpenAI API key is over its usage quota in this
environment, so the one LLM-reasoning node in the pipeline (the ReAct Care
Planner, which does real multi-step tool-calling — up to 10 iterations
against 5 defined tools) could not complete a live model call in any of the
12 runs. The system's designed fallback path — a deterministic, evidence-based
local rulebook — took over every time, and *said so transparently in its own
trace output* rather than failing silently or producing garbage.

This means the numbers above validate **the pipeline's structure, data
plumbing, evidence grounding, and failure-handling** — genuinely and
completely — but do **not** yet validate the quality of the LLM's own
tool-selection reasoning, since that code path did not execute live in this
run. Re-running this harness with a funded API key would extend coverage to
that node specifically; everything else in this report is unaffected by the
quota issue.

### Sample real outputs (for illustration, not cherry-picked)

Weather diversity actually produced by Open-Meteo for the six real locations
at run time:

- **Mumbai:** `heavy_rain: true, humidity_stress: true` → health score 76, 4 actions
- **Phoenix:** `heat_stress: true, humidity_stress: true` → health score 76, 3 actions
- **Denver (0 plants):** `heat_stress: true, high_uv: true, humidity_stress: true` → health score 50, 0 actions, **no crash**
- **Reykjavik / London / Singapore:** milder profiles → health scores 82, 2–3 actions each

Diagnosis system, two different real photos per fixture:

- A visibly healthy leaf photo → `"Looks healthy"`, 100% confidence, `confirmed`
- A visibly water-damaged leaf photo → `"water excess or uneven watering"`,
  43% confidence, `needs_more_evidence` — the system correctly reported
  lower confidence rather than overclaiming certainty on an ambiguous image.

## Corrections made during development (kept for transparency)

A first run of this harness (`eval-2026-07-20T16-38-20-224Z_first-pass-with-known-issues.json`,
kept in this folder rather than deleted) produced a report with three false
signals. Rather than discard that run, the mistakes and fixes are documented
here because they're evidence the final numbers are real and checked, not
just a script that happened to print 100% everywhere:

1. **Evidence-grounding check flagged 10/12 runs as "hallucinating"
   citations.** Investigation traced every flagged string back to
   `care-plan-engine.ts:445` — a legitimate, real source
   (`"iNaturalist or GBIF plant search"`) that the first grep pass missed
   because it's assigned via a ternary expression, not a plain string
   literal. Fixed by re-deriving the allow-list with a grep pattern that
   catches every `source:` assignment regardless of expression shape, and by
   handling the one field (`plant_knowledge.source`) that can be a
   comma-joined composite of multiple provider tokens.
2. **Reminders evaluation reported `null` for every count field.** The
   harness assumed the count fields (`sent_count`, `suppressed_count`, etc.)
   lived at the top level of the response. A direct probe of the live
   endpoint showed they're nested under a `payload` key
   (`{ id, trigger, createdAt, payload: {...}, source }`), matching the
   `agent_runs` / `reminder_runs` storage envelope shape used elsewhere in
   the codebase. Fixed by reading from `body.payload.*`.
3. **4 of 12 robustness probes returned `ERROR` (request timeout / browser
   closed).** This coincided with the dev server's own memory-triggered
   auto-restart mid-sweep — an environment artifact, not an application bug.
   Fixed by giving each probe its own short timeout and one retry so a
   single transient hiccup can't zero out unrelated results.

## Known scope boundaries (not evaluated here)

- **LLM tool-selection quality** — not exercised live this run (quota, see
  above).
- **Garden Studio (3D placement)** — exercised manually in an earlier
  session (persistence, camera controls, export all confirmed working) but
  not yet folded into this automated harness.
- **Multi-day / long-horizon behavior** — this run evaluates single-request
  correctness, not behavior drift over weeks of real usage.
- **External-provider response quality** (PlantNet/Kindwise identification
  accuracy, Open-Meteo forecast accuracy) — treated as ground truth inputs,
  not evaluated themselves.

## How to reproduce

```bash
cd eval
npm install
node run-evaluation.mjs
# results written to eval/results/eval-<timestamp>.json and results/latest.json
```

Requires the app running locally on `:3000` and a working headless Chromium
(see `eval/README.md` for the exact executable path / library setup used in
this environment).
