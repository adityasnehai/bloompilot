# BloomPilot

BloomPilot is a premium gardening AI SaaS prototype. The current release focuses on:

- a strong product identity and theme system
- sign-up and sign-in flows
- onboarding for location, garden type, and reminder preferences
- plant collection CRUD
- recurring care tasks
- persistent SQLite workspace data
- a live server-side agent brief runtime
- reminder sweep runtime with stored scheduler runs
- photo diagnosis runtime with stored image-backed health records
- shared JSON APIs for web and future mobile clients
- external LangGraph service package for orchestration

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS v4
- Server Actions
- Cookie-backed local session flow

## Local Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment

The app reads branding and session settings from `.env.local`.

```bash
cp .env.example .env.local
```

## Current Scope

Final showcase scope includes:

- landing page
- auth shell
- onboarding
- dashboard
- settings
- garden collection
- care task queue
- agent brief
- reminders
- diagnosis
- SQLite persistence
- agent JSON endpoint
- reminder JSON endpoint
- diagnosis JSON endpoint
- workspace JSON endpoint
- plants/tasks/mobile JSON endpoints
- external agent service package

## Project Context Files

Use these files as the stable repo memory:

- `PROJECT_CONTEXT.md`
- `docs/current-state.md`
- `docs/next-phase.md`

## External Service

BloomPilot now includes `services/agent-service`, a dedicated FastAPI + LangGraph
package that can orchestrate the agent outside the Next.js app when
`AGENT_SERVICE_URL` is configured.

## Status

The planned showcase phases are complete. Remaining work is optional production
hardening or a separate mobile client.
