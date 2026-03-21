# HisabKitab — Claude Code Agent Conventions

This file contains mandatory conventions for all Claude Code agents working on this repository.
Read this file in full before making any changes.

---

## Project Overview

HisabKitab is an AI-first group expense splitter for the Indian market.
- **Mobile**: React Native + Expo (`apps/mobile/`)
- **Web/API**: Next.js 14 App Router on Vercel (`apps/web/`)
- **DB**: Supabase (Postgres + Auth + Storage + Realtime)
- **AI**: Anthropic Claude API (`packages/ai/`)
- **Shared**: Types, utils, constants (`packages/shared/`, `packages/db/`)

---

## MANDATORY Security Rules

### 1. Never Hardcode Secrets
- **NEVER** put API keys, tokens, passwords, or secrets in source code.
- **NEVER** commit `.env`, `.env.local`, or any file with real credentials.
- Only `.env.example` with placeholder values is allowed in git.

### 2. Environment Variables
- **Server-side** (Next.js API routes, `packages/*`): use `process.env.VAR_NAME`
- **Mobile** (Expo): use `Constants.expoConfig?.extra?.varName` from `expo-constants`
  ```ts
  import Constants from 'expo-constants';
  const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl as string;
  ```
- **Next.js client-side**: only `NEXT_PUBLIC_` prefixed vars, accessed via `process.env.NEXT_PUBLIC_VAR`
- **Expo client-side**: only `EXPO_PUBLIC_` prefixed vars (Expo SDK 49+)

### 3. Every Protected API Route Must Call `requireAuth`
```ts
// apps/web/app/api/some-route/route.ts
import { requireAuth } from '@/lib/auth';

export async function POST(req: Request) {
  const user = await requireAuth(req); // throws 401 if not authenticated
  // ... rest of handler
}
```

### 4. Row-Level Security (RLS)
- RLS **must be enabled** on every Supabase table.
- Every migration must include `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`
- Never use `service_role` key on the client side — only in server-side API routes.

---

## AI / Claude API Rules

### 5. Prompt Versioning — MANDATORY
Every Claude API call **must** include `prompt_version` in the metadata:
```ts
const response = await anthropic.messages.create({
  model: 'claude-opus-4-5',
  messages: [...],
  metadata: {
    user_id: userId,
    prompt_version: 'expense-parser-v1.2', // <-- ALWAYS include this
  },
});
```
- Prompt versions follow `<prompt-name>-v<major>.<minor>` format.
- Bump minor version for wording changes, major for structural changes.

### 6. Token Usage Logging
Every Claude API call result must be logged to `agent_metrics`:
```ts
await logAgentMetric({
  agent_name: 'expense-parser',
  prompt_version: 'expense-parser-v1.2',
  input_tokens: response.usage.input_tokens,
  output_tokens: response.usage.output_tokens,
  latency_ms: Date.now() - startTime,
  success: true,
});
```

### 7. Prompt Injection Guard
API routes that accept user-provided text and pass it to Claude must sanitize:
```ts
// SECURITY: Sanitize user input before inserting into prompts
// Never interpolate raw user text directly into system prompts.
// Use the userMessage parameter in the human turn only.
const userText = sanitizeForPrompt(req.body.message);
```

---

## Architecture Rules

### 8. Agents Call Each Other as Function Imports — Never HTTP
```ts
// CORRECT: direct function import
import { parseExpense } from '@hisabkitab/ai';

// WRONG: never do this inside the monorepo
const result = await fetch('http://localhost:3000/api/ai/parse', ...);
```

### 9. Input Validation with Zod — Everywhere
All API route inputs, AI outputs, and shared function params must be validated with Zod:
```ts
import { z } from 'zod';

const CreateExpenseSchema = z.object({
  amount: z.number().positive(),
  description: z.string().min(1).max(500),
  // ...
});

const parsed = CreateExpenseSchema.safeParse(req.body);
if (!parsed.success) {
  return Response.json({ error: parsed.error.flatten() }, { status: 400 });
}
```

### 10. Database Queries Live in `packages/db/`
Never write raw Supabase queries in `apps/`. Import from `@hisabkitab/db`:
```ts
import { getGroupById, createExpense } from '@hisabkitab/db';
```

---

## Code Style

### TypeScript
- Strict mode enabled — no `any` without explicit justification comment.
- Prefer `type` over `interface` for object shapes (unless extending).
- All async functions must handle errors (try/catch or `.catch()`).
- Use `satisfies` operator for type-checking object literals when useful.

### File Structure
- One component/function per file for complex logic.
- Co-locate tests next to source files: `foo.ts` → `foo.test.ts`.
- Use barrel exports (`index.ts`) at package boundaries only.

### Naming
- Files: `kebab-case.ts`
- React components: `PascalCase`
- Functions/variables: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE`
- Database tables: `snake_case` (matches Postgres convention)
- Zod schemas: `PascalCaseSchema` (e.g., `CreateExpenseSchema`)

---

## Monorepo Structure

```
hisabkitab/
├── apps/
│   ├── mobile/          # Expo React Native app
│   └── web/             # Next.js 14 app (API + web)
├── packages/
│   ├── ai/              # Claude API client, prompts, schemas
│   ├── db/              # Supabase client, types, queries
│   └── shared/          # Types, constants, utilities
├── supabase/
│   └── migrations/      # SQL migration files (never edit manually)
├── tech-design/         # Architecture decision records (architect-agent)
├── turbo.json
├── package.json
└── CLAUDE.md            # This file
```

### Package Names
- `@hisabkitab/db`
- `@hisabkitab/ai`
- `@hisabkitab/shared`

---

## Observability

### Agent Metrics Table
Every AI operation must be tracked. Use the helper:
```ts
import { logAgentMetric } from '@hisabkitab/db';

await logAgentMetric({
  agent_name: 'expense-parser' | 'chat-assistant' | 'reminder',
  prompt_version: string,
  input_tokens: number,
  output_tokens: number,
  latency_ms: number,
  success: boolean,
  error_message?: string,
  group_id?: string,
  user_id?: string,
});
```

---

## Migrations

- All schema changes go through `supabase/migrations/` as numbered SQL files.
- Format: `YYYYMMDDHHMMSS_description.sql`
- Never modify an existing migration — always create a new one.
- Every new table needs: `ENABLE ROW LEVEL SECURITY` + appropriate policies.

---

## Testing

- Unit tests: use Vitest for packages, Jest for Next.js.
- Never mock Supabase in unit tests — use a real test DB or `supabase local`.
- AI tests: use recorded fixtures, not live API calls (to avoid cost + flakiness).

---

## Common Mistakes to Avoid

1. Using `supabase.from('table').select()` without RLS — always test with anon key.
2. Returning raw DB errors to the client — always return sanitized error messages.
3. Not logging AI token usage — every Claude call must be logged.
4. Skipping Zod validation — every external input must be validated.
5. Using `console.log` in production paths — use structured logging.
6. Forgetting `await` on async DB calls — TypeScript strict mode catches most, but be vigilant.

---

## Orchestrator Agent — `/manager` (MANDATORY)

**ALWAYS use the orchestrator agent (`/manager`) for ALL tasks.** This is not optional. Every task — whether it touches one file or twenty — must go through the orchestrator to ensure consistency, coordination, and quality. The orchestrator decides which specialist agents are needed and manages the workflow.

Invoke it via the `/manager` slash command (defined in `.claude/commands/manager.md`). The orchestrator is defined in `.claude/agents/orchestrator.md`.

### When to use the orchestrator
- **ALWAYS** — for every task, regardless of size or scope
- The orchestrator will determine the right level of effort (e.g., skip architect-agent for a trivial fix, or engage the full pipeline for a feature)

### Parallel execution — MANDATORY
The orchestrator **MUST run independent agents in parallel** to maximize speed and efficiency:
- **db-agent + frontend-agent** can run in parallel when their work is independent (e.g., migration + UI scaffold)
- **test-web-agent + test-mobile-agent + review-agent** MUST always run in parallel after implementation is complete
- **backend-agent + frontend-agent** can run in parallel when the API contract is defined upfront by the architect-agent
- Only serialize agents when there is a true data dependency (e.g., backend-agent needs db-agent's types)

### Delegation pipeline
The orchestrator decomposes work and delegates in order (parallelizing where possible):
0. **architect-agent** — produces a tech-design document (`tech-design/`) with design decisions, file manifest, and acceptance criteria. All downstream agents MUST follow the architect's design. Defines API contracts so downstream agents can run in parallel.
1. **db-agent** — migrations, query functions, types (`packages/db/`, `supabase/migrations/`)
2. **backend-agent** — API routes (`apps/web/app/api/`) — can run in parallel with frontend-agent when API contract is defined
3. **frontend-agent** — UI pages and components (`apps/web/app/`) — can run in parallel with backend-agent
4. **test-web-agent** — Web E2E tests (Playwright) and unit tests (Vitest) — runs in parallel with review-agent and test-mobile-agent
5. **test-mobile-agent** (if `apps/mobile/` touched) — Mobile E2E tests with Maestro, screenshots to `apps/mobile/.maestro/screenshots/` — runs in parallel with test-web-agent and review-agent
6. **review-agent** — security, convention, AND architecture compliance check (read-only) — runs in parallel with test agents
7. **web-deploy-agent** — builds and deploys `apps/web/` to Vercel via CLI (never via git push). Defaults to preview; production only when explicitly requested. Runs in parallel with mobile-build-agent when both are needed.
8. **mobile-build-agent** (optional) — builds Android APK locally if `apps/mobile/` was touched. Runs in parallel with web-deploy-agent.

### Coordination rules
- The architect-agent's design doc is the **single source of truth** — all agents read it before starting work.
- Agents must not duplicate work — the orchestrator assigns clear ownership boundaries.
- If an agent encounters a conflict with another agent's output, it reports back to the orchestrator rather than overwriting.
- The orchestrator verifies all agents' outputs are consistent before considering the task complete.

### Tech design documents
Every non-trivial feature gets a design document in `tech-design/` before implementation begins. See `tech-design/architecture-principles.md` for the foundational rules that all agents must follow.

See `.claude/agents/` for each agent's full specification.
