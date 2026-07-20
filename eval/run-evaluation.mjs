// BloomPilot Agent & API Evaluation Harness
//
// Purpose: automated, non-human, non-mocked evaluation of the multi-agent
// care-plan pipeline, the diagnosis system, the reminders system, and API
// contract robustness — run against a live local instance of the real app
// (real HTTP requests, real SQLite persistence, real Open-Meteo weather API
// calls per fixture location, real onboarding/auth flow).
//
// Every "fixture" below is a genuine account created through the real
// sign-up + onboarding + plant-setup UI flow (via Playwright), not a
// database insert or a stubbed session. Every metric is computed from the
// actual JSON responses returned by the running server.
//
// Usage: node eval/run-evaluation.mjs
// Requires: playwright-core + a working Chromium executable (see README
// note at bottom of this file if libnspr4/libnss3 are missing).

import { chromium } from "playwright-core";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = "http://localhost:3000";
const CHROME_PATH =
  process.env.EVAL_CHROME_PATH ||
  path.join(process.env.HOME, ".cache/ms-playwright/chromium-1228/chrome-linux64/chrome");

// ── Evidence-source allow-list, derived programmatically from source code ──
// Built from: grep -n "source:" src/lib/*.ts   (every literal / ternary value
// assigned to an evidence `source` field or a plant-knowledge `source` field
// across care-plan-engine.ts, agent-graph.ts, care-planner-react.ts,
// context-builder.ts, plant-knowledge.ts, plant-enrichment.ts, diagnosis.ts).
// See eval/README.md for the full audit trail.
const KNOWN_EVIDENCE_SOURCES = new Set([
  "Add Plant Form",
  "BloomPilot AI Diagnosis",
  "BloomPilot ReAct Care Planner (GPT-4.1-mini + tool calling)",
  "BloomPilot ReAct Care Planner",
  "BloomPilot context builder",
  "BloomPilot diagnosis history",
  "BloomPilot plant setup",
  "BloomPilot user notification settings",
  "Evidence Agent",
  "Garden Studio saved layout",
  "Local care rulebook",
  "Open-Meteo Forecast API",
  "PlantNet API, iNaturalist, or GBIF user-selected search result",
  "iNaturalist or GBIF plant search",
  "PlantNet API",
  "SQLite workspace profile and plant records",
  "Saved garden location coordinates",
  "open_meteo",
  "search",
  "unknown",
  "seed_v1",
  "perenual",
  "trefle",
  "plant_knowledge_db",
  "perenual_api",
  "perenual_api_unavailable",
  "local_rulebook_v1",
  "saved_location_coordinates",
  "user_input_only",
  "agent_reasoning",
  "plant_context",
]);

// plant_knowledge.source can be a comma-joined list of individual tokens
// (see plant-enrichment.ts: sources.push("perenual") / sources.push("trefle")
// then k.sources.join(", ")). A source string is grounded if it exactly
// matches a known source OR every comma-separated token in it does.
function isGroundedSource(value) {
  if (KNOWN_EVIDENCE_SOURCES.has(value)) return true;
  if (value.includes(", ")) {
    return value.split(", ").every((token) => KNOWN_EVIDENCE_SOURCES.has(token.trim()));
  }
  return false;
}

const FIXTURES = [
  {
    id: "mumbai-balcony",
    label: "Mumbai, India — Balcony — tropical monsoon",
    locationQuery: "Mumbai",
    gardenType: "Balcony garden",
    plants: ["Tomato", "Basil"],
  },
  {
    id: "phoenix-backyard",
    label: "Phoenix, Arizona — Backyard — hot desert",
    locationQuery: "Phoenix",
    gardenType: "Backyard garden",
    plants: ["Rosemary", "Aloe vera"],
  },
  {
    id: "reykjavik-balcony",
    label: "Reykjavik, Iceland — Balcony — subpolar oceanic",
    locationQuery: "Reykjavik",
    gardenType: "Balcony garden",
    plants: ["Mint"],
  },
  {
    id: "singapore-indoor",
    label: "Singapore — Indoor — tropical rainforest",
    locationQuery: "Singapore",
    gardenType: "Indoor collection",
    plants: ["Fern", "Pothos"],
  },
  {
    id: "london-backyard",
    label: "London, UK — Backyard — temperate oceanic",
    locationQuery: "London",
    gardenType: "Backyard garden",
    plants: ["Lavender"],
  },
  {
    id: "denver-empty",
    label: "Denver, Colorado — Balcony — EDGE CASE: zero plants",
    locationQuery: "Denver",
    gardenType: "Balcony garden",
    plants: [],
  },
];

const DIAGNOSIS_FIXTURES = ["mumbai-balcony", "phoenix-backyard"]; // sample 2/6, real photos
const DIAGNOSIS_IMAGES = [
  path.join(__dirname, "../public/diag-leaf.jpg"),
  path.join(__dirname, "../public/infected.png"),
];

function nowIso() {
  return new Date().toISOString();
}

function pct(n, d) {
  return d === 0 ? null : Math.round((n / d) * 1000) / 10;
}

async function timed(fn) {
  const t0 = Date.now();
  const result = await fn();
  return { result, ms: Date.now() - t0 };
}

// ── Account creation via real UI flow ───────────────────────────────────────
async function createFixtureAccount(browser, fixture) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const email = `eval-${fixture.id}-${Date.now()}@bloompilot.app`;
  const password = "EvalHarness123!";
  const log = [];

  const { ms: signupMs } = await timed(async () => {
    await page.goto(`${BASE}/sign-up`, { waitUntil: "load", timeout: 60000 });
    await page.fill('input[name="firstName"]', "Eval");
    await page.fill('input[name="lastName"]', fixture.id);
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await Promise.all([
      page.waitForURL((u) => !u.pathname.includes("sign-up"), { timeout: 30000 }),
      page.click('button[type="submit"]'),
    ]);
    await page.waitForLoadState("load");
  });
  log.push(`sign-up ok (${signupMs}ms)`);

  const { ms: onboardMs } = await timed(async () => {
    await page.fill('input[placeholder*="Search a city"]', fixture.locationQuery);
    await page.waitForTimeout(2200);
    const suggestion = page.locator(".auth-location-suggestions button").first();
    await suggestion.click({ timeout: 10000 });
    await page.waitForTimeout(600);
    await page.locator("button", { hasText: /^Continue$/ }).first().click();
    await page.waitForTimeout(1000);

    const typeBtn = page.locator("button", { hasText: fixture.gardenType }).first();
    if (await typeBtn.isVisible().catch(() => false)) {
      await typeBtn.click();
      await page.waitForTimeout(300);
    }
    await page.locator("button", { hasText: /^Continue$/ }).first().click();
    await page.waitForTimeout(1000);

    const morn = page.locator("button", { hasText: "Morning" }).first();
    if (await morn.isVisible().catch(() => false)) {
      await morn.click();
      await page.waitForTimeout(300);
    }
    await page.locator("button", { hasText: /Continue|Finish/ }).first().click();
    await page.waitForURL(/plant-setup/, { timeout: 30000 });
  });
  log.push(`onboarding wizard ok (${onboardMs}ms)`);

  const plantsAdded = [];
  for (const plantName of fixture.plants) {
    try {
      const search = page.locator('input[placeholder*="Search plant name"]');
      await search.click();
      await search.fill("");
      await search.fill(plantName);
      await page.waitForTimeout(3200);
      const selectBtn = page.locator("button", { hasText: "Select" }).first();
      if (await selectBtn.isVisible().catch(() => false)) {
        await selectBtn.click();
        await page.waitForTimeout(1200);
        const addBtn = page.locator("button", { hasText: /^Add plant$/ }).first();
        await addBtn.click({ timeout: 10000 });
        await page.waitForTimeout(1500);
        plantsAdded.push(plantName);
      }
    } catch (e) {
      log.push(`plant "${plantName}" failed: ${String(e.message || e).slice(0, 150)}`);
    }
  }

  const finishBtn = page.locator("a, button", {
    hasText: fixture.plants.length > 0 ? "Continue to dashboard" : "Skip for now",
  }).first();
  await finishBtn.click();
  await page.waitForTimeout(2500);
  const landedUrl = page.url();

  return { ctx, page, email, log, plantsAdded, landedUrl };
}

// ── Structural / grounding / consistency checks on a care plan payload ─────
function evaluateCarePlan(plan, fixture) {
  const checks = [];
  const requiredKeys = [
    "today_actions",
    "plant_plans",
    "weather_risks",
    "evidence_sources",
    "agent_traces",
    "summary",
  ];
  const missingKeys = requiredKeys.filter((k) => !(k in plan));
  checks.push({
    name: "schema_required_keys_present",
    pass: missingKeys.length === 0,
    detail: missingKeys.length ? `missing: ${missingKeys.join(", ")}` : "all present",
  });

  const actions = Array.isArray(plan.today_actions) ? plan.today_actions : [];
  const allEvidence = actions.flatMap((a) => a.evidence_refs || []);
  const unknownSources = allEvidence
    .map((e) => e.source)
    .filter((s) => s && !isGroundedSource(s));
  checks.push({
    name: "evidence_grounding_no_hallucinated_sources",
    pass: unknownSources.length === 0,
    detail:
      unknownSources.length === 0
        ? `${allEvidence.length} evidence refs, all sources recognized`
        : `unrecognized sources: ${[...new Set(unknownSources)].join(", ")}`,
  });

  const validPlantIds = new Set([null, undefined, ...((plan.plant_plans || []).map((p) => p.plant_id))]);
  const badRefs = actions.filter((a) => a.plant_id && !validPlantIds.has(a.plant_id));
  checks.push({
    name: "referential_integrity_action_plant_ids",
    pass: badRefs.length === 0,
    detail: badRefs.length === 0 ? "all action plant_id refs resolve" : `${badRefs.length} dangling refs`,
  });

  const keys = actions.map((a) => `${a.plant_id ?? "garden"}|${a.type}|${a.due_date}`);
  const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
  checks.push({
    name: "no_duplicate_actions",
    pass: dupes.length === 0,
    detail: dupes.length === 0 ? "no duplicates" : `${dupes.length} duplicate action keys`,
  });

  const rain = plan.weather_risks?.heavy_rain === true;
  const wateringOnRainDay = actions.filter(
    (a) => rain && /water/i.test(a.title) && !/not water|skip|delay/i.test(a.title),
  );
  checks.push({
    name: "weather_constraint_no_watering_push_on_heavy_rain",
    pass: !rain || wateringOnRainDay.length === 0,
    detail: !rain
      ? "heavy_rain not active for this run, check not applicable"
      : wateringOnRainDay.length === 0
        ? "heavy_rain active, no contradictory watering-push actions"
        : `heavy_rain active but ${wateringOnRainDay.length} action(s) push watering`,
  });

  const rejected = new Set((plan.rejected_actions || []).map((a) => a.id || JSON.stringify(a)));
  const approvedIds = new Set(actions.map((a) => a.id));
  const overlap = [...rejected].filter((id) => approvedIds.has(id));
  checks.push({
    name: "no_overlap_between_approved_and_rejected",
    pass: overlap.length === 0,
    detail: overlap.length === 0 ? "disjoint sets" : `${overlap.length} ids in both sets`,
  });

  const traces = Array.isArray(plan.agent_traces) ? plan.agent_traces : [];
  const expectedAgents = [
    "Context Builder Agent",
    "Environment Agent",
    "Plant Knowledge Agent",
    "ReAct Care Planner",
    "Evidence Agent",
    "Reminder Agent",
    "Dashboard Agent",
  ];
  const presentAgents = new Set(traces.map((t) => t.agent_name));
  const missingAgents = expectedAgents.filter((a) => !presentAgents.has(a));
  checks.push({
    name: "all_7_pipeline_agents_ran",
    pass: missingAgents.length === 0,
    detail: missingAgents.length === 0 ? "7/7 agent traces present" : `missing: ${missingAgents.join(", ")}`,
  });

  const reactTrace = traces.find((t) => t.agent_name === "ReAct Care Planner");
  const fallbackUsed = Boolean(
    reactTrace && /local care rules|did not submit|Retry the care plan/i.test(reactTrace.output_summary || ""),
  );

  const emptyGardenFixture = fixture.plants.length === 0;
  checks.push({
    name: "empty_garden_handled_without_crash",
    pass: !emptyGardenFixture || (Array.isArray(actions) && plan.summary),
    detail: emptyGardenFixture ? "0-plant fixture produced a well-formed (possibly empty) plan" : "n/a",
  });

  return {
    checks,
    passRate: pct(checks.filter((c) => c.pass).length, checks.length),
    fallbackUsed,
    actionCount: actions.length,
    healthScore: plan.summary?.health_score ?? null,
    weatherRisks: plan.weather_risks,
    toolCallCount: reactTrace ? undefined : undefined,
  };
}

async function apiCall(requestCtx, method, urlPath, opts = {}) {
  const timeoutMs = opts.timeout ?? 60000;
  const { ms, result } = await timed(() =>
    requestCtx[method](`${BASE}${urlPath}`, { ...opts, timeout: timeoutMs }),
  );
  let body = null;
  try {
    body = await result.json();
  } catch {
    try {
      body = await result.text();
    } catch {
      body = null;
    }
  }
  return { status: result.status(), body, ms };
}

async function main() {
  console.log(`[${nowIso()}] BloomPilot evaluation harness starting`);
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--use-gl=swiftshader", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });

  const results = {
    meta: {
      startedAt: nowIso(),
      baseUrl: BASE,
      methodology:
        "All fixtures are real accounts created via the live sign-up + onboarding + plant-setup UI. " +
        "Weather is fetched live per-location from Open-Meteo by the app's own backend, not mocked. " +
        "Evidence-source allow-list is extracted programmatically from literal `source:` string " +
        "assignments across src/lib/*.ts (see eval/README.md). No human labeling or grading was used " +
        "anywhere in this run.",
    },
    fixtures: [],
    carePlanEval: [],
    diagnosisEval: [],
    reminderEval: [],
    robustnessEval: [],
  };

  const builtFixtures = [];
  for (const fixture of FIXTURES) {
    console.log(`[fixture] creating ${fixture.id}...`);
    try {
      const built = await createFixtureAccount(browser, fixture);
      builtFixtures.push({ fixture, ...built });
      results.fixtures.push({
        id: fixture.id,
        label: fixture.label,
        email: built.email,
        plantsRequested: fixture.plants,
        plantsAdded: built.plantsAdded,
        landedUrl: built.landedUrl,
        log: built.log,
        status: "created",
      });
      console.log(`[fixture] ${fixture.id} ok — plants added: ${built.plantsAdded.length}/${fixture.plants.length}`);
    } catch (e) {
      results.fixtures.push({ id: fixture.id, label: fixture.label, status: "FAILED", error: String(e.message || e) });
      console.log(`[fixture] ${fixture.id} FAILED: ${e.message}`);
    }
  }

  // ── Care-plan generation evaluation: 2 runs per fixture (determinism check) ──
  for (const bf of builtFixtures) {
    const runs = [];
    for (let i = 0; i < 2; i++) {
      const { status, body, ms } = await apiCall(bf.ctx.request, "post", "/api/care-plan/generate");
      const plan = body?.care_plan || body;
      const evalResult = status === 200 ? evaluateCarePlan(plan, bf.fixture) : null;
      runs.push({ run: i + 1, status, ms, evalResult, actionCount: evalResult?.actionCount ?? null });
      await new Promise((r) => setTimeout(r, 500));
    }
    const bothOk = runs.every((r) => r.status === 200);
    const actionCounts = runs.map((r) => r.actionCount);
    const deterministic = bothOk && actionCounts[0] === actionCounts[1];
    results.carePlanEval.push({
      fixtureId: bf.fixture.id,
      runs,
      bothRunsSucceeded: bothOk,
      actionCountStableAcrossRuns: deterministic,
    });
    console.log(
      `[care-plan] ${bf.fixture.id}: run1=${runs[0].status}/${runs[0].ms}ms run2=${runs[1].status}/${runs[1].ms}ms stable=${deterministic}`,
    );
  }

  // ── Diagnosis evaluation ────────────────────────────────────────────────
  for (const bf of builtFixtures) {
    if (!DIAGNOSIS_FIXTURES.includes(bf.fixture.id) || bf.plantsAdded.length === 0) continue;
    for (const imgPath of DIAGNOSIS_IMAGES) {
      try {
        const plantsResp = await apiCall(bf.ctx.request, "get", "/api/plants");
        const plantId = plantsResp.body?.plants?.[0]?.id;
        if (!plantId) continue;
        const fileBuffer = readFileSync(imgPath);
        const { ms, result } = await timed(() =>
          bf.ctx.request.post(`${BASE}/api/diagnosis/analyze`, {
            multipart: {
              plantId,
              photo: {
                name: path.basename(imgPath),
                mimeType: imgPath.endsWith(".png") ? "image/png" : "image/jpeg",
                buffer: fileBuffer,
              },
            },
            timeout: 60000,
          }),
        );
        let body = null;
        try {
          body = await result.json();
        } catch {}
        const status = result.status();
        const run = body?.run || body;
        const valid =
          status === 200 &&
          run &&
          typeof run.confidence === "number" &&
          run.confidence >= 0 &&
          run.confidence <= 100 &&
          typeof run.issue === "string" &&
          run.issue.length > 0 &&
          typeof run.severity === "string" &&
          typeof run.evidenceStatus === "string";
        results.diagnosisEval.push({
          fixtureId: bf.fixture.id,
          image: path.basename(imgPath),
          status,
          ms,
          responseSchemaValid: valid,
          confidence: run?.confidence ?? null,
          issue: run?.issue ?? null,
          evidenceStatus: run?.evidenceStatus ?? null,
        });
        console.log(`[diagnosis] ${bf.fixture.id}/${path.basename(imgPath)}: status=${status} ms=${ms} schemaValid=${valid}`);
      } catch (e) {
        results.diagnosisEval.push({
          fixtureId: bf.fixture.id,
          image: path.basename(imgPath),
          status: "ERROR",
          error: String(e.message || e).slice(0, 200),
        });
      }
    }
  }

  // ── Reminders evaluation ───────────────────────────────────────────────
  // Response shape (confirmed empirically, see eval/README.md):
  //   { id, trigger, createdAt, payload: { sent_count, suppressed_count,
  //     failed_count, queued_count, channel_stats, suppression_reasons,
  //     notes: ["Timezone: <IANA>", "Window: <label>", "Window active now: yes|no", ...] },
  //     source }
  for (const bf of builtFixtures) {
    const { status, body, ms } = await apiCall(bf.ctx.request, "get", "/api/reminders/run?refresh=1");
    const payload = body?.payload ?? null;
    const sent = payload?.sent_count ?? null;
    const suppressed = payload?.suppressed_count ?? null;
    const failed = payload?.failed_count ?? null;
    const queued = payload?.queued_count ?? null;
    const deliveryCount = payload?.deliveryCount ?? null;
    const channelStats = payload?.channel_stats ?? null;
    const suppressionReasons = payload?.suppression_reasons ?? [];
    const notes = payload?.notes ?? [];

    const countsValid = [sent, suppressed, failed, queued].every((v) => typeof v === "number" && v >= 0);
    let channelSumsMatch = true;
    if (channelStats) {
      const sums = Object.values(channelStats).reduce(
        (acc, c) => ({
          sent: acc.sent + (c.sent || 0),
          suppressed: acc.suppressed + (c.suppressed || 0),
          failed: acc.failed + (c.failed || 0),
        }),
        { sent: 0, suppressed: 0, failed: 0 },
      );
      channelSumsMatch = sums.sent === sent && sums.suppressed === suppressed && sums.failed === failed;
    }

    // Independent cross-check: the app states "Window active now: yes|no" and
    // "Timezone: <IANA>" / "Window: HH:MM AM - HH:MM AM" in its own notes.
    // Recompute the same fact independently (Node Intl, no app code reused)
    // and verify the app's own claim is actually true right now.
    let windowClaimVerified = null;
    let windowClaimDetail = "no window-active note found";
    const tzNote = notes.find((n) => n.startsWith("Timezone:"));
    const windowNote = notes.find((n) => n.startsWith("Window:") && !n.startsWith("Window active"));
    const activeNote = notes.find((n) => n.startsWith("Window active now:"));
    if (tzNote && windowNote && activeNote) {
      try {
        const tz = tzNote.replace("Timezone:", "").trim();
        const [startLabel, endLabel] = windowNote.replace("Window:", "").trim().split(" - ");
        const to24h = (label) => {
          const m = label.trim().match(/(\d+):(\d+)\s*(AM|PM)/i);
          let h = parseInt(m[1], 10);
          const min = parseInt(m[2], 10);
          const ap = m[3].toUpperCase();
          if (ap === "PM" && h !== 12) h += 12;
          if (ap === "AM" && h === 12) h = 0;
          return h * 60 + min;
        };
        const startMin = to24h(startLabel);
        const endMin = to24h(endLabel);
        const parts = new Intl.DateTimeFormat("en-US", {
          timeZone: tz,
          hour: "numeric",
          minute: "numeric",
          hourCycle: "h23",
        }).formatToParts(new Date());
        const h = parseInt(parts.find((p) => p.type === "hour").value, 10);
        const m = parseInt(parts.find((p) => p.type === "minute").value, 10);
        const nowMin = h * 60 + m;
        const independentlyComputedActive = nowMin >= startMin && nowMin < endMin;
        const appClaimedActive = activeNote.includes("yes");
        windowClaimVerified = independentlyComputedActive === appClaimedActive;
        windowClaimDetail = `tz=${tz} nowLocal=${h}:${String(m).padStart(2, "0")} window=${startLabel.trim()}-${endLabel.trim()} appClaims=${appClaimedActive} independentlyComputed=${independentlyComputedActive}`;
      } catch (e) {
        windowClaimDetail = `verification error: ${String(e.message || e).slice(0, 100)}`;
      }
    }

    const internallyConsistent = status === 200 && countsValid && channelSumsMatch;
    results.reminderEval.push({
      fixtureId: bf.fixture.id,
      status,
      ms,
      sent,
      suppressed,
      failed,
      queued,
      deliveryCount,
      suppressionReasonCount: suppressionReasons.length,
      channelSumsMatch,
      internallyConsistent,
      windowClaimVerified,
      windowClaimDetail,
    });
    console.log(
      `[reminders] ${bf.fixture.id}: status=${status} ms=${ms} sent=${sent} suppressed=${suppressed} failed=${failed} channelSumsMatch=${channelSumsMatch} windowClaimVerified=${windowClaimVerified}`,
    );
  }

  // ── API robustness / contract sweep ────────────────────────────────────
  const authed = builtFixtures[0]?.ctx.request;
  const anonCtx = await browser.newContext();
  const anon = anonCtx.request;

  const probes = [
    { name: "unauth_dashboard", method: "get", path: "/api/dashboard", client: "anon", expect: [401] },
    { name: "unauth_tasks", method: "get", path: "/api/tasks", client: "anon", expect: [401] },
    { name: "unauth_plants", method: "get", path: "/api/plants", client: "anon", expect: [401] },
    { name: "unauth_care_plan_generate", method: "post", path: "/api/care-plan/generate", client: "anon", expect: [401] },
    { name: "unauth_context_current", method: "get", path: "/api/context/current", client: "anon", expect: [401] },
    { name: "missing_param_plants_health", method: "get", path: "/api/plants/health", client: "auth", expect: [400] },
    { name: "missing_param_diagnosis_by_plant", method: "get", path: "/api/diagnosis/by-plant", client: "auth", expect: [400] },
    { name: "nonexistent_plant_health", method: "get", path: "/api/plants/health?plantId=nonexistent-eval-id-xyz", client: "auth", expect: [200, 404] },
    { name: "nonexistent_task_toggle", method: "post", path: "/api/tasks/nonexistent-eval-id-xyz/toggle", client: "auth", expect: [404] },
    { name: "missing_param_weather", method: "get", path: "/api/weather", client: "auth", expect: [400] },
    { name: "empty_location_search", method: "get", path: "/api/location/search?q=", client: "auth", expect: [200, 400] },
    { name: "missing_param_plants_photo_post", method: "post", path: "/api/plants/photo", client: "auth", expect: [400] },
  ];

  for (const probe of probes) {
    const requestCtx = probe.client === "anon" ? anon : authed;
    // Each probe gets its own short timeout + one retry so a single transient
    // hiccup (e.g. dev-server GC pause) can't zero out the whole sweep.
    let lastErr = null;
    let done = false;
    for (let attempt = 0; attempt < 2 && !done; attempt++) {
      try {
        const { status, ms } = await apiCall(requestCtx, probe.method, probe.path, { timeout: 15000 });
        const graceful = status < 500;
        const expected = probe.expect.includes(status);
        results.robustnessEval.push({ ...probe, status, ms, graceful, matchesExpectedStatus: expected, attempt: attempt + 1 });
        console.log(`[robustness] ${probe.name}: status=${status} graceful=${graceful} expected=${expected} (attempt ${attempt + 1})`);
        done = true;
      } catch (e) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, 800));
      }
    }
    if (!done) {
      results.robustnessEval.push({
        ...probe,
        status: "ERROR",
        graceful: false,
        matchesExpectedStatus: false,
        error: String(lastErr?.message || lastErr).slice(0, 150),
      });
      console.log(`[robustness] ${probe.name}: ERROR after 2 attempts`);
    }
  }
  await anonCtx.close();

  // ── Aggregate summary ───────────────────────────────────────────────────
  const cpRuns = results.carePlanEval.flatMap((f) => f.runs.filter((r) => r.status === 200 && r.evalResult));
  const allChecks = cpRuns.flatMap((r) => r.evalResult.checks);
  const cpLatencies = results.carePlanEval.flatMap((f) => f.runs.map((r) => r.ms)).sort((a, b) => a - b);
  const p95 = (arr) => (arr.length ? arr[Math.min(arr.length - 1, Math.floor(arr.length * 0.95))] : null);

  results.summary = {
    fixturesCreated: results.fixtures.filter((f) => f.status === "created").length,
    fixturesAttempted: FIXTURES.length,
    carePlan: {
      totalRuns: results.carePlanEval.reduce((n, f) => n + f.runs.length, 0),
      successfulRuns: cpRuns.length,
      successRatePct: pct(cpRuns.length, results.carePlanEval.reduce((n, f) => n + f.runs.length, 0)),
      determinismRatePct: pct(
        results.carePlanEval.filter((f) => f.actionCountStableAcrossRuns).length,
        results.carePlanEval.length,
      ),
      structuralCheckPassRatePct: pct(allChecks.filter((c) => c.pass).length, allChecks.length),
      fallbackUsedRatePct: pct(cpRuns.filter((r) => r.evalResult.fallbackUsed).length, cpRuns.length),
      latencyMsMedian: cpLatencies[Math.floor(cpLatencies.length / 2)] ?? null,
      latencyMsP95: p95(cpLatencies),
      checksByName: Object.fromEntries(
        [...new Set(allChecks.map((c) => c.name))].map((name) => {
          const forName = allChecks.filter((c) => c.name === name);
          return [name, { pass: forName.filter((c) => c.pass).length, total: forName.length }];
        }),
      ),
    },
    diagnosis: {
      totalScans: results.diagnosisEval.length,
      schemaValidRatePct: pct(
        results.diagnosisEval.filter((d) => d.responseSchemaValid).length,
        results.diagnosisEval.length,
      ),
      latencyMsMedian:
        results.diagnosisEval.map((d) => d.ms).filter(Boolean).sort((a, b) => a - b)[
          Math.floor(results.diagnosisEval.length / 2)
        ] ?? null,
    },
    reminders: {
      totalRuns: results.reminderEval.length,
      internallyConsistentRatePct: pct(
        results.reminderEval.filter((r) => r.internallyConsistent).length,
        results.reminderEval.length,
      ),
      windowClaimVerifiedRatePct: pct(
        results.reminderEval.filter((r) => r.windowClaimVerified === true).length,
        results.reminderEval.filter((r) => r.windowClaimVerified !== null).length,
      ),
    },
    robustness: {
      totalProbes: results.robustnessEval.length,
      gracefulRatePct: pct(results.robustnessEval.filter((r) => r.graceful).length, results.robustnessEval.length),
      matchesExpectedRatePct: pct(
        results.robustnessEval.filter((r) => r.matchesExpectedStatus).length,
        results.robustnessEval.length,
      ),
    },
  };

  results.meta.finishedAt = nowIso();

  for (const bf of builtFixtures) await bf.ctx.close();
  await browser.close();

  const outDir = path.join(__dirname, "results");
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonPath = path.join(outDir, `eval-${stamp}.json`);
  writeFileSync(jsonPath, JSON.stringify(results, null, 2));
  writeFileSync(path.join(outDir, "latest.json"), JSON.stringify(results, null, 2));
  console.log(`\n[${nowIso()}] done. Results written to ${jsonPath}`);
  console.log(JSON.stringify(results.summary, null, 2));
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
