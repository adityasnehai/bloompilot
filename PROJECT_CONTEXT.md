# BloomPilot Project Context

## Product

BloomPilot is a premium gardening AI SaaS prototype.

Core product direction:

- web-first now, mobile later
- premium SaaS UI, not a generic dashboard
- gardening-focused AI product, not a generic chatbot
- current goal is a polished end-to-end showcase project
- production hardening comes later

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS v4
- Server Actions
- Vercel deployment

## Current Architecture

- frontend, persistence, and agent runtime live in the same Next.js app
- session state is cookie-backed
- garden state is stored in SQLite
- workspace profile is stored in SQLite
- agent runs are stored in SQLite
- reminder runs are stored in SQLite
- diagnosis runs are stored in SQLite
- shared JSON APIs expose the workspace for non-web clients
- an external LangGraph service package exists under `services/agent-service`

## UX Direction

- premium, warm, botanical visual system
- clear hierarchy
- minimal module structure
- implementation over over-explanation
- avoid generic AI styling

## Implementation Mode

Default working style for future sessions:

- inspect first, then implement
- keep answers concise
- do not repeat stable project background
- update context docs when major milestones change

## Live Deployment

- production alias: `https://verdio-nine.vercel.app`

Note:

- branding is BloomPilot, but external Vercel slug still uses the older project alias

## Source Of Truth Files

- `README.md`
- `PROJECT_CONTEXT.md`
- `docs/current-state.md`
- `docs/next-phase.md`
