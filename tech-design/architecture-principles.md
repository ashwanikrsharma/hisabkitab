# HisabKitab — Architecture Principles

**Status:** Approved
**Date:** 2026-03-20
**Author:** architect-agent

## 1. Overview

This document defines the foundational architecture, layering rules, and best practices that govern all development in the HisabKitab monorepo. Every agent and contributor must follow these principles. Deviations require a new tech-design document with explicit justification.

## 2. System Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     CLIENTS                               │
│  Next.js Pages (SSR)  │  Client Components  │  Mobile    │
└──────────┬─────────────┴─────────┬──────────┴────────────┘
           │ Server Components     │ fetch('/api/...')
┌──────────▼───────────────────────▼───────────────────────┐
│                    API LAYER                               │
│            apps/web/app/api/**                             │
│   requireAuth → Zod validate → @hisabkitab/db → respond  │
└──────────────────────┬───────────────────────────────────┘
                       │ function calls (never HTTP)
┌──────────────────────▼───────────────────────────────────┐
│               DATA ACCESS LAYER                           │
│              packages/db/src/                              │
│     queries/ → client.ts → Supabase → Postgres + RLS     │
└──────────────────────────────────────────────────────────┘
```

## 3. Layering Rules

### 3.1 Strict Layer Boundaries

Each layer may only call the layer directly below it. Never skip layers.

| Layer | May call | Must NOT call |
|-------|----------|---------------|
| **Pages / Components** | API routes (via `fetch`), `@hisabkitab/shared` utils | `@hisabkitab/db` directly, Supabase client directly (except auth in Server Components) |
| **API Routes** | `@hisabkitab/db` functions, `@hisabkitab/shared` utils | Supabase client directly, other API routes via HTTP |
| **DB Queries** | Supabase client (`getServerClient()`) | API routes, components, external HTTP |
| **Shared Package** | Nothing (pure functions only) | DB, API, Supabase, anything async |

### 3.2 Exception: Server Component Auth

Server Components (pages) may call `supabase.auth.getUser()` directly for auth checks and `redirect('/login')`. This is the ONLY permitted direct Supabase usage in the app layer.

## 4. Data Layer Principles

### 4.1 Single Data Access Layer

All database queries MUST live in `packages/db/src/queries/`. This provides:
- **Type safety** — Centralized types in `types.ts`
- **Testability** — Query functions can be unit tested
- **Consistency** — One place to enforce patterns (error handling, typing)
- **Security** — RLS policies are the source of truth, but authorization logic in queries provides defense-in-depth

### 4.2 Migration Discipline

- Migrations are **immutable** — once committed, never modify
- Every new table: `ENABLE ROW LEVEL SECURITY` + policies + FK indexes + timestamps
- Naming: `YYYYMMDDHHMMSS_description.sql`
- Test RLS policies with anon key, never rely on service_role for app queries

### 4.3 Type Hierarchy

```
DB Row Types (packages/db/src/types.ts)
  └── snake_case, nullable, matches Postgres exactly
       └── used by: query functions, API routes

Shared Client Types (packages/shared/src/types/index.ts)
  └── camelCase, non-nullable where safe, client-friendly
       └── used by: frontend components, mobile app
```

Do NOT use shared types for DB operations. Do NOT use DB types in frontend components.

## 5. API Layer Principles

### 5.1 Handler Pipeline

Every API route handler follows this exact sequence:

```
1. requireAuth(req)         → 401 if unauthenticated
2. Zod.safeParse(input)     → 400 if invalid
3. Authorization check       → 403 if not permitted
4. @hisabkitab/db call       → 500 if DB error (sanitized)
5. createActivity().catch()  → fire-and-forget logging
6. Return JSON response      → typed response body
```

No step may be skipped. Steps 1-3 are **guards** that exit early.

### 5.2 Authorization vs Authentication

- **Authentication** (Step 1): "Is this a logged-in user?" — handled by `requireAuth`
- **Authorization** (Step 3): "Can this user access this resource?" — handler must verify group membership, resource ownership, or admin role before proceeding

### 5.3 Error Handling

- **Never** expose raw DB errors, stack traces, or internal details to clients
- API errors return `{ error: string }` with a human-readable message
- Validation errors return `{ error: ZodFlattenedError }` with field-level details
- Log the real error with `console.error` for debugging

### 5.4 Inter-Service Communication

Within the monorepo, agents call each other as **function imports**, never HTTP:

```ts
// CORRECT
import { parseExpense } from '@hisabkitab/ai';

// WRONG — never fetch your own API from server code
const res = await fetch('http://localhost:3000/api/ai/parse');
```

## 6. Frontend Layer Principles

### 6.1 Component Strategy

| Type | When | Directive | Data |
|------|------|-----------|------|
| **Server Component** | Data display, static pages | None (default) | Fetch in component body |
| **Client Component** | Forms, interactivity, state | `'use client'` | Fetch via `fetch('/api/...')` in effects/handlers |

Prefer Server Components. Extract the smallest interactive piece into a Client Component.

### 6.2 Cache Invalidation Contract

Every client-side mutation (POST, PATCH, DELETE via fetch) MUST call `router.refresh()` after success. This invalidates the RSC cache so parent Server Component pages show fresh data.

Pattern:
```ts
const res = await fetch('/api/resource', { method: 'POST', ... });
if (res.ok) {
  router.push('/target-page');
  router.refresh();  // MANDATORY
}
```

### 6.3 Form Pattern

All client-side forms must:
1. Show a **loading state** during submission (disable button, show spinner)
2. Show **error state** on failure (error banner with API error message)
3. Show **success state** or navigate away on success
4. Call `router.refresh()` to invalidate stale server-rendered data

### 6.4 Design System

Use the established HisabKitab design tokens (`glass-header`, `card`, `btn-primary`, `btn-secondary`, `input-field`, `text-ink`, `text-accent`, `text-currency`). Do not introduce new design patterns without documenting them.

## 7. Testing Principles

### 7.1 Test Pyramid

```
          E2E (Playwright)           — few, critical user flows
        /                    \
      Component (Vitest+RTL)         — form behavior, router.refresh, error states
    /                          \
  Unit (Vitest)                      — pure functions, DB queries
```

### 7.2 Rules

- **No Supabase mocks** in unit tests — use real test DB or test at the API route level
- **AI tests** use recorded fixtures — never live API calls
- **Co-locate** tests: `foo.ts` → `foo.test.ts` in the same directory
- **Test behavior, not implementation** — assert on outcomes, not internal calls

### 7.3 What to Test

| Layer | Must test | May skip |
|-------|-----------|----------|
| DB queries | Error handling, edge cases | Happy path (covered by API tests) |
| API routes | Auth, validation, authorization, error responses | Internal wiring |
| Components | Form submission, error display, cache invalidation | Static rendering |
| E2E | Critical user flows (create expense, settle up) | Admin, edge cases |

## 8. Security Principles

### 8.1 Defense in Depth

Security is enforced at every layer:

```
Middleware   → session refresh, redirect unauthenticated
API Route   → requireAuth, Zod validation, authorization check
DB Query    → parameterized queries (Supabase client handles this)
Postgres    → RLS policies (ultimate source of truth)
```

A bug in one layer should not compromise security because the next layer catches it.

### 8.2 Secrets Management

- **NEVER** hardcode secrets in source code
- Server-side: `process.env.VAR_NAME`
- Client-side: `process.env.NEXT_PUBLIC_VAR_NAME` only
- `.env.example` with placeholder values is the only env file in git

### 8.3 Input Sanitization

- All API inputs: Zod validation
- User text into PostgREST filters: escape special characters
- User text into Claude prompts: sanitize and place in human turn only

## 9. Observability Principles

### 9.1 Structured Logging

- `console.error` for errors in production paths (not `console.log`)
- Include context: `console.error('[POST /api/expenses]', err)`
- Activity log (`createActivity`) for user-visible state changes

### 9.2 AI Metrics

Every Claude API call must:
1. Include `prompt_version` in metadata
2. Log input/output tokens, latency, success/failure to `agent_metrics`
3. Use `logAgentMetric()` from `@hisabkitab/db`

## 10. Decision Record: Why These Choices

| Decision | Choice | Alternatives Considered | Rationale |
|----------|--------|------------------------|-----------|
| Data access layer | Centralized `packages/db/` | Raw Supabase in routes | Type safety, consistency, testability |
| Auth model | Supabase Auth (cookie-based) | JWT + custom auth | Zero-ops, built-in RLS integration |
| API style | REST via Next.js API Routes | tRPC, GraphQL | Simplicity, AI-generatable, no client dependency |
| State management | Server Components + fetch | React Query, SWR, Zustand | Minimal client JS, Next.js native |
| Styling | Tailwind + custom design tokens | CSS modules, styled-components | Co-located, performant, design-system friendly |
| Monorepo tool | Turborepo | Nx, Lerna | Simple config, fast builds, zero-setup |
| Testing | Vitest (unit) + Playwright (E2E) | Jest, Cypress | Speed (Vitest), reliability (Playwright) |
| Cache invalidation | `router.refresh()` after mutations | React Query, SWR revalidation | Aligned with Server Components model |
