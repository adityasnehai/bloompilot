# Current State

## Phase

Current phase: `Phase 6`

## Implemented

- landing page
- sign-up and sign-in
- onboarding
- settings
- protected app shell
- garden collection
- recurring care tasks
- dashboard backed by persistent workspace data
- operator-style agent runtime with stored runs
- reminder runtime with stored scheduler runs
- photo diagnosis runtime with stored health records
- shared JSON APIs for plants, tasks, diagnosis, workspace, and mobile bootstrap
- external LangGraph service package
- agent JSON endpoint
- reminder JSON endpoint
- diagnosis JSON endpoint
- workspace JSON endpoint

## Main Routes

- `/`
- `/sign-in`
- `/sign-up`
- `/onboarding`
- `/dashboard`
- `/garden`
- `/tasks`
- `/agent`
- `/diagnosis`
- `/reminders`
- `/settings`
- `/api/mobile/bootstrap`

## Data Model Status

Current local domain objects:

- session
- plants
- care tasks
- activity log
- reminder runs
- diagnosis runs
- mobile bootstrap payload

Current persistence:

- session cookie for auth state
- SQLite for workspace, plants, tasks, activities, agent runs, reminder runs, and diagnosis runs

## Important Files

- `src/lib/session.ts`
- `src/lib/database.ts`
- `src/lib/workspace-store.ts`
- `src/lib/garden.ts`
- `src/lib/agent-tools.ts`
- `src/lib/agent-runtime.ts`
- `src/lib/reminders.ts`
- `src/lib/diagnosis.ts`
- `src/lib/api-session.ts`
- `src/lib/workspace-contracts.ts`
- `src/lib/workspace-mutations.ts`
- `src/lib/agent-service.ts`
- `src/app/actions.ts`
- `src/app/agent-actions.ts`
- `src/app/reminder-actions.ts`
- `src/app/diagnosis-actions.ts`
- `src/app/garden-actions.ts`
- `src/components/layout/app-shell.tsx`
- `src/app/(app)/dashboard/page.tsx`
- `src/app/(app)/garden/page.tsx`
- `src/app/(app)/tasks/page.tsx`
- `src/app/(app)/agent/page.tsx`
- `src/app/(app)/diagnosis/page.tsx`
- `src/app/(app)/reminders/page.tsx`
- `services/agent-service/`

## Build Status

Verified locally:

- `npm run lint`
- `npm run build`

## Known Intentional Limits

- no Supabase yet
- no mobile app yet
