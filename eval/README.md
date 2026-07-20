# BloomPilot Evaluation Harness

Automated, non-human evaluation of BloomPilot's multi-agent care-plan
pipeline, diagnosis system, reminders engine, and API contract robustness —
run against a live local instance of the real application.

**Full results and methodology:** [`results/EVAL_REPORT.md`](./results/EVAL_REPORT.md)
**Raw data:** [`results/latest.json`](./results/latest.json)

## What it does

1. Creates 6 real accounts through the actual sign-up → onboarding →
   plant-setup UI (Playwright-driven, not database inserts), spanning 6
   different real-world locations and garden types so the app's live
   Open-Meteo weather calls produce genuinely different conditions per
   fixture.
2. Calls `/api/care-plan/generate` twice per fixture and runs 8 objective,
   code-based checks against each response: schema validity, evidence
   grounding (no hallucinated citations), referential integrity, duplicate
   detection, a weather-vs-action consistency rule, rejected/approved
   disjointness, full 7-agent trace presence, and empty-garden handling.
3. Runs real diagnosis scans (two different real photos) against 2 fixtures
   and validates response schema + confidence range.
4. Runs the reminders engine on all 6 fixtures and independently
   recomputes (via Node's `Intl` API, not reusing app code) whether each
   account's reminder window should be active right now, then checks that
   against what the app itself claimed.
5. Probes the API with no auth, missing params, and bad IDs, checking for
   graceful 4xx responses rather than 500s or hangs.
6. Writes a timestamped JSON file plus `results/latest.json`.

No step uses human labeling, human grading, or a second LLM as judge — every
check is a deterministic assertion against a real HTTP response.

## Running it

```bash
cd eval
npm install
node run-evaluation.mjs
```

Requires:
- The app running locally on `http://localhost:3000` (`npm run dev` from the
  project root).
- A working headless Chromium. This environment uses Playwright's cached
  Chromium build directly (not `npx playwright install`, which requires
  `sudo`):
  ```bash
  # if libnspr4.so / libnss3.so are missing:
  cd /tmp && apt-get download libnspr4 libnss3
  for f in *.deb; do dpkg -x "$f" extract/; done
  LD_LIBRARY_PATH=/tmp/extract/usr/lib/x86_64-linux-gnu \
    EVAL_CHROME_PATH=~/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome \
    node run-evaluation.mjs
  ```

## Notes

- Each run creates 6 new `eval-<fixture>-<timestamp>@bloompilot.app`
  accounts in whatever database the app is currently pointed at
  (`DATABASE_FILE_PATH` in `.env.local`). Safe to re-run repeatedly — it
  never touches or deletes existing accounts.
- The evidence-source allow-list in `run-evaluation.mjs` was built by
  grepping every literal and computed `source:` assignment across
  `src/lib/*.ts`. If new evidence sources are added to the app, re-run that
  grep and update the allow-list, or the grounding check will start
  reporting false positives (see `results/EVAL_REPORT.md` → "Corrections
  made during development" for exactly this failure mode happening once
  already).
