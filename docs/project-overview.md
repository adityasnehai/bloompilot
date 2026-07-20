# BloomPilot Project Overview

## Purpose
BloomPilot is an AI-assisted home gardening product that helps people track plants, understand local growing context, generate daily care actions, diagnose plant issues from photos, and deliver reminders through the right channels.

The product goal is not just to store plant data. It tries to turn garden context, weather, care history, and plant knowledge into actionable guidance that is specific to the user’s setup.

## Product Goals

- Help a user onboard their garden quickly with location, garden type, and reminder preferences.
- Keep a persistent plant collection with care history, tasks, notes, and diagnoses.
- Generate a daily care plan from current context rather than generic gardening advice.
- Surface likely plant health issues from photos and attach them to the right plant.
- Support reminder delivery across in-app, email, browser push, and WhatsApp.
- Provide a future-friendly architecture where the web app and an external agent service can share the same core workspace data.

## What The Product Includes

### User-facing flows

- Authentication and onboarding
- Preferences setup for location, garden type, and reminder channels
- Plant setup and plant collection management
- Dashboard with care plan and alert summary
- Diagnosis workflow with photo upload and result history
- Task queue for watering, inspection, and feeding
- Reminder center with channel readiness and send history
- Garden Studio for placement planning and sun-zone guidance
- Chat and stats/history views for deeper interaction and tracking
- Settings for profile, notification, and delivery preferences

### Main product surfaces

- `src/app/page.tsx` is the marketing landing page.
- `src/app/(auth)/*` contains sign-in, sign-up, onboarding redirect, and preferences setup.
- `src/app/(app)/*` contains the protected product experience.
- `src/app/garden-studio/*` contains the 3D placement planning experience.

## Core Architecture

### Web app

- Built with Next.js 16 and React 19.
- Uses app router, server components, server actions, and route handlers.
- The protected app shell lives in `src/components/layout/app-shell.tsx`.
- Navigation is split between a top nav and a sidebar-style nav, depending on the screen.

### Data and session model

- The app uses a cookie-backed session stored in `src/lib/session.ts`.
- Workspace and plant data are persisted in SQLite through helpers in `src/lib/database.ts`, `src/lib/garden.ts`, `src/lib/workspace-store.ts`, and related modules.
- The session captures the user’s name, email, location, garden type, reminder window, channels, and onboarding state.

### Agent orchestration

- The main care-planning agent pipeline lives in `src/lib/agent-graph.ts`.
- The planner pulls together context, weather, plant knowledge, and care rules before creating a care plan.
- The external optional FastAPI/LangGraph service is in `services/agent-service`.
- The service exposes `/health`, `/brief`, `/reminders/sweep`, and `/diagnosis` so other clients can share the same orchestration layer.

### Notifications

- Email, browser push, and WhatsApp are supported in the reminder layer.
- Notification logic is centered in `src/lib/reminders.ts` and the files under `src/lib/notifications/`.
- Reminder sending is policy-driven, with suppression rules, deduplication, and channel readiness checks.

## Main Domain Objects

### Session / workspace identity

- Describes who the gardener is and how BloomPilot should communicate with them.
- Includes onboarding status, reminder timing, garden type, location, and preferred channels.

### Plant

- Represents a tracked plant with nickname, species, placement, sunlight, watering interval, and notes.
- Stored and read through `src/lib/garden.ts`.

### Care task

- Represents recurring or generated work such as watering, inspection, and feeding.
- The task queue is used by the dashboard, tasks page, and reminder engine.

### Garden context snapshot

- Built in `src/lib/context-builder.ts`.
- Combines user inputs, garden type, location, weather, plant knowledge, and studio placement data.
- This snapshot is the main input to the care planner.

### Care plan

- Produced by the agent pipeline in `src/lib/care-plan-engine.ts` and `src/lib/agent-graph.ts`.
- Includes watering forecast, weather risk, care calendar, setup mismatches, and reminder readiness.

### Diagnosis run

- Stores a photo-based plant health scan, evidence status, confidence, treatment steps, and follow-up guidance.
- Implemented in `src/lib/diagnosis.ts`.

### Reminder run

- Stores reminder delivery attempts, suppression reasons, channel stats, and notification outcomes.
- Implemented in `src/lib/reminders.ts`.

## Key User Flows

### First visit

1. User lands on the marketing page.
2. User signs up or signs in.
3. If onboarding is incomplete, they are routed to preferences setup.
4. Preferences capture location, garden type, and reminder channels.

### Plant setup

1. User adds plants from the garden screen or the app shell quick action.
2. The workflow can search by name or use an uploaded photo.
3. Placement, sunlight, soil, and watering mode are confirmed.
4. Plants become available to the dashboard, tasks, diagnosis, and reminders.

### Dashboard and care planning

1. `src/app/(app)/dashboard/page.tsx` loads the latest context snapshot.
2. If the snapshot is stale, it is rebuilt.
3. If the care plan is missing or out of date, the agent pipeline regenerates it.
4. The dashboard then shows care priorities, alerts, and recommendations.

### Diagnosis

1. User uploads a photo for a tracked plant.
2. The diagnosis engine validates the file and reads the current plant context.
3. Diagnosis results are stored and rendered with a status that reflects confidence and evidence level.
4. Confirmed issues can feed follow-up care actions.

### Reminders

1. The reminder page shows channel readiness and the latest sweep.
2. Reminder checks respect the user’s delivery window and channel setup.
3. Cron can sweep all active users during their allowed time window.

## Important Pages

- `src/app/page.tsx`: landing page and marketing hero.
- `src/app/(auth)/sign-in/page.tsx`: sign-in entry.
- `src/app/(auth)/sign-up/page.tsx`: sign-up entry.
- `src/app/(auth)/preferences/page.tsx`: onboarding preferences.
- `src/app/(app)/dashboard/page.tsx`: care plan dashboard.
- `src/app/(app)/garden/page.tsx`: plant management.
- `src/app/(app)/diagnosis/page.tsx`: diagnosis upload and history.
- `src/app/(app)/tasks/page.tsx`: recurring task queue.
- `src/app/(app)/reminders/page.tsx`: reminder control center.
- `src/app/(app)/chat/page.tsx`: conversational garden assistant.
- `src/app/(app)/stats/page.tsx`: garden metrics and trends.
- `src/app/(app)/history/page.tsx`: care plan history.
- `src/app/(app)/settings/page.tsx`: profile and notification settings.
- `src/app/garden-studio/page.tsx`: placement planning studio.

## Important Components

- `src/components/layout/app-shell.tsx`: protected app frame and quick plant add flow.
- `src/components/layout/app-top-nav.tsx`: main in-app navigation.
- `src/components/layout/sidebar-nav.tsx`: secondary navigation list.
- `src/components/dashboard/care-dashboard.tsx`: dashboard rendering.
- `src/components/plants/add-plant-workflow.tsx`: plant onboarding and editing flow.
- `src/components/tasks/tasks-view.tsx`: task list and task interactions.
- `src/components/chat/chat-view.tsx`: conversational UI.
- `src/components/settings/push-subscription-card.tsx`: browser push setup.
- `src/components/location/location-picker.tsx`: location search and coordinate capture.
- `src/components/forms/*`: shared form inputs and preference controls.
- `src/components/home/*`: landing-page marketing and product story sections.

## Important Libraries

- `src/lib/garden.ts`: plant CRUD, task helpers, garden state, placement normalization.
- `src/lib/context-builder.ts`: builds the unified care-planning context.
- `src/lib/care-plan-engine.ts`: generates care actions and care-plan output.
- `src/lib/agent-graph.ts`: orchestrates the multi-step care agent pipeline.
- `src/lib/diagnosis.ts`: manages diagnosis runs and evidence gating.
- `src/lib/reminders.ts`: prepares, filters, and sends reminders.
- `src/lib/weather.ts`: weather lookup and snapshot support.
- `src/lib/plant-knowledge.ts` and related files: species care knowledge and enrichment.
- `src/lib/alert-observer.ts`: watches for urgent anomalies after care-plan runs.
- `src/lib/studio-advisor.ts` and `src/app/garden-studio/*`: placement guidance and layout simulation.

## API Surface

### Context and plan

- `GET /api/dashboard`
- `GET /api/context/current`
- `GET /api/context/build`
- `GET /api/care-plan/current`
- `POST /api/care-plan/generate`
- `GET /api/care-plan/history`

### Plants and garden

- `GET /api/plants`
- `POST /api/plants`
- `GET /api/plants/[plantId]`
- `POST /api/plants/log-care`
- `POST /api/plants/photo`
- `GET /api/plants/health`
- `GET /api/plants/trend`

### Diagnosis

- `POST /api/diagnosis/analyze`
- `GET /api/diagnosis/runs`
- `GET /api/diagnosis/photo/[runId]`
- `GET /api/diagnosis/by-plant`

### Reminders and notifications

- `GET /api/reminders/cron`
- `POST /api/reminders/run`
- `GET /api/reminders/escalation`
- `POST /api/notifications/push/subscribe`
- `POST /api/notifications/push/unsubscribe`

### Supporting endpoints

- `GET /api/mobile/bootstrap`
- `GET /api/weather`
- `GET /api/location/search`
- `GET /api/location/reverse`
- `POST /api/feedback`

## Design Notes

- The UI intentionally uses a warm, garden-themed visual system rather than a generic SaaS layout.
- The landing page emphasizes an atmospheric hero video and light, organic motion.
- App screens use rounded surfaces, soft contrast, and strong hierarchy to keep the product feeling calm and legible.
- Shared design primitives live in `src/components/ui/`.

## Operational Notes

- The dashboard is not static. It rebuilds context and can regenerate the care plan when stale.
- Diagnosis only accepts tracked plants and image uploads up to 4 MB.
- Reminder sending is gated by channel setup and reminder-window policy.
- The external agent service is optional, but it is designed so a future mobile client can reuse the same orchestration contract.

## Production Readiness Pending

- SQLite currently defaults to `/tmp/bloompilot.sqlite`. This is suitable for local development but is not durable on Vercel or other serverless deployments. Production must use a persistent mounted volume or an external database such as Postgres, Turso, or SQLite Cloud.
- Live provider verification is pending valid production credentials for OpenAI, PlantNet, Perenual, Kindwise, Resend, Twilio, and Web Push where those integrations are enabled.
- These are deployment requirements, not mock-data dependencies. The application must fail clearly or remain evidence-limited when a provider is not configured.

## Files To Know First

- `src/app/page.tsx`
- `src/app/(app)/dashboard/page.tsx`
- `src/app/(app)/diagnosis/page.tsx`
- `src/app/(app)/reminders/page.tsx`
- `src/lib/session.ts`
- `src/lib/garden.ts`
- `src/lib/context-builder.ts`
- `src/lib/care-plan-engine.ts`
- `src/lib/agent-graph.ts`
- `src/lib/reminders.ts`
- `src/lib/diagnosis.ts`
- `services/agent-service/app/main.py`
- `services/agent-service/app/graph.py`
- `services/agent-service/app/models.py`

## Maintenance Intent

If future work changes product behavior, update this file first so it stays the canonical high-level map of the product, the main flows, and the code areas that implement them.
