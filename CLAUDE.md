# HisabKitab — Claude Code Agent Conventions

This file contains mandatory conventions for all Claude Code agents working on this repository.
Read this file in full before making any changes.

---

## Project Overview

HisabKitab is an AI-first group expense splitter for the Indian market.
- **Mobile**: React Native + Expo (`src/mobile/`)
- **Web/API**: Next.js 14 App Router on Vercel (`src/web/`)
- **DB**: Supabase (Postgres + Auth + Storage + Realtime)
- **AI**: Anthropic Claude API (`packages/ai/`)
- **Shared**: Types, utils, constants (`src/shared/`, `src/services/`)

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
// src/web/app/api/some-route/route.ts
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

### 10. Database Queries Live in `src/services/`
Never write raw Supabase queries in `apps/`. Import from `@hisabkitab/services`:
```ts
import { getGroupById, createExpense } from '@hisabkitab/services';
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
├── src/
│   ├── web/             # Next.js 14 app (API + web)
│   ├── mobile/          # Expo React Native app
│   ├── services/        # Supabase client, types, queries (was packages/db)
│   ├── shared/          # Types, constants, utilities
│   └── supabase/        # SQL migration files (never edit manually)
│       └── migrations/
├── tech-design/         # Architecture decision records (architect-agent)
├── turbo.json
├── package.json
└── CLAUDE.md            # This file
```

### Package Names
- `@hisabkitab/services` (was `@hisabkitab/services`)
- `@hisabkitab/shared`

---

## Observability

### Agent Metrics Table
Every AI operation must be tracked. Use the helper:
```ts
import { logAgentMetric } from '@hisabkitab/services';

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

- All schema changes go through `src/supabase/migrations/` as numbered SQL files.
- Format: `YYYYMMDDHHMMSS_description.sql`
- Never modify an existing migration — always create a new one.
- Every new table needs: `ENABLE ROW LEVEL SECURITY` + appropriate policies.

---

## Testing & Regression Prevention

### Test Requirements
- Unit tests: use Vitest for packages and Next.js.
- Never mock Supabase in unit tests — use a real test DB or `supabase local`.
- AI tests: use recorded fixtures, not live API calls (to avoid cost + flakiness).

### Regression Rules (MANDATORY)
- **Every new API route** must have tests: auth (401), validation (400), success (200/201)
- **Every bug fix** must include a test that reproduces the bug and verifies the fix
- **Every new UI component** must have a render test
- **All existing tests must pass** before any deployment — zero tolerance for regressions
- Run `npx turbo test --force` before every commit that touches source code
- Run `npx turbo build && npx turbo type-check` to verify no build/type regressions

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

**ALWAYS use the orchestrator agent (`/manager`) for ALL tasks.** Every task — regardless of size — must go through the orchestrator. It decides which specialist agents are needed and manages the workflow.

Invoke via `/manager`. Defined in `.claude/agents/orchestrator.md`. See `.claude/agents/` for all agent specs.
