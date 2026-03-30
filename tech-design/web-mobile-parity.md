# Web-Mobile Parity -- Technical Design

**Status:** Draft
**Date:** 2026-03-30
**Author:** architect-agent

---

## 1. Overview

This document covers six features that close gaps between the HisabKitab web and mobile experiences. Three features bring web capabilities to mobile (split types, settlement workflow, sync conflict UI), one brings a mobile capability to web (dark mode), and two are net-new mobile features (AI expense parsing, push notifications). The features are designed to be largely independent so most can be implemented in parallel.

---

## 2. Requirements

### Functional
- F1: Mobile users can create expenses with exact-amount and percentage splits, matching web
- F3: Mobile users can view settlement status badges and confirm/dispute settlements
- F4: Web users can toggle dark mode; system preference is respected by default
- F5: Mobile users can view and resolve sync conflicts from a dedicated screen
- F6: Mobile users can type natural language or photograph a receipt to auto-fill expense fields
- F7: Mobile users receive push notifications for key group events

### Non-Functional
- All new API routes follow requireAuth + Zod + sanitized-error pattern
- All new DB tables have RLS enabled with appropriate policies
- All new AI calls include prompt_version metadata and token logging
- No regressions to existing functionality
- Mobile components respect the existing theme system (light/dark)
- Web dark mode has zero flash of wrong theme on load

---

## 3. Design Decisions

### Decision 1: Split Type Input Strategy on Mobile

- **Options considered:**
  A. Bottom sheet with per-member inputs (like Splitwise)
  B. Inline expandable section below the SplitTypePicker
  C. Separate screen for split details
- **Chosen:** B -- Inline expandable section
- **Rationale:** The web already uses an inline approach (checkboxes + input fields per member). Keeping the same UX model reduces cognitive load for cross-platform users. A bottom sheet adds navigation complexity; a separate screen breaks flow.
- **Trade-offs:** Longer scroll on the add-expense screen when many members exist. Mitigated by the 50-member group limit.

### Decision 2: Dark Mode Implementation Strategy for Web

- **Options considered:**
  A. Tailwind `darkMode: 'class'` with CSS custom properties
  B. Tailwind `darkMode: 'media'` only (system preference)
  C. CSS custom properties without Tailwind dark mode
- **Chosen:** A -- class strategy with CSS custom properties
- **Rationale:** Allows both manual toggle and system preference detection. The class strategy gives users explicit control while `prefers-color-scheme` serves as the default. CSS variables centralize color definitions and prevent scattered dark: prefixes.
- **Trade-offs:** Requires a small client-side script in `<head>` to read localStorage before paint (prevents flash). Adds a ThemeProvider component on web.

### Decision 3: AI Expense Parsing Architecture

- **Options considered:**
  A. Direct Claude API call from mobile (client-side)
  B. Server-side API route that mobile calls
  C. Edge function for lower latency
- **Chosen:** B -- Server-side API route
- **Rationale:** CLAUDE.md mandates that AI calls go through server-side code for prompt versioning, token logging, and secret protection. The API key must never be on the client. Edge functions add deployment complexity for marginal latency gain.
- **Trade-offs:** Additional network hop from mobile. Mitigated by keeping the route lightweight and streaming is unnecessary for structured parsing.

### Decision 4: Push Notification Token Storage

- **Options considered:**
  A. Store tokens in user profile (add column to users table)
  B. Dedicated push_tokens table with device-level granularity
- **Chosen:** B -- Dedicated table
- **Rationale:** Users may have multiple devices. A dedicated table allows storing multiple tokens per user with device metadata, and cleaning up stale tokens without touching the users table.
- **Trade-offs:** Extra table and join. Worth it for correctness.

### Decision 5: Sync Conflict Resolution Approach

- **Options considered:**
  A. Auto-resolve all conflicts (server always wins)
  B. Manual resolution UI for all conflicts
  C. Auto-resolve most, surface only data-loss conflicts to user
- **Chosen:** C -- Hybrid approach
- **Rationale:** Most conflicts (server wins) are already auto-resolved by the sync engine. The UI surfaces unacknowledged conflicts so users can review what happened. For future enhancement, users can override resolutions.
- **Trade-offs:** Phase 1 is read-only review + acknowledge. Manual override (keep local) can be added later.

### Decision 6: Settlement Status Update on Mobile

- **Options considered:**
  A. New mobile-specific API route
  B. Reuse existing PATCH /api/settlements/[id] route
- **Chosen:** B -- Reuse existing route
- **Rationale:** The web API route already exists, validates input with Zod, and checks authorization (party to settlement). No reason to duplicate.
- **Trade-offs:** None meaningful.

---

## 4. Architecture

### 4.1 Data Model Changes

#### New Table: `push_tokens`

```sql
CREATE TABLE push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  device_id TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, token)
);

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own push tokens"
  ON push_tokens FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_push_tokens_user_id ON push_tokens(user_id);
CREATE INDEX idx_push_tokens_active ON push_tokens(is_active) WHERE is_active = true;
```

Migration file: `20260330000000_add_push_tokens.sql`

#### No schema changes needed for Features 1, 3, 4, 5

- Feature 1 (splits): The `expense_splits` table already supports `amount` and `percentage` columns. The `expenses.split_type` column already accepts 'equal', 'exact', 'percentage'. No DB changes needed.
- Feature 3 (settlement status): The `settlements.status` column already supports 'pending', 'confirmed', 'disputed'. The PATCH API route already exists. No DB changes needed.
- Feature 4 (dark mode): Pure frontend. No DB changes.
- Feature 5 (sync conflicts): The `sync_conflicts` table already exists in the local SQLite schema. No server-side DB changes needed.

### 4.2 API Layer

#### New Route: POST /api/ai/parse-expense

Parses natural language text into structured expense data using Claude.

- **Auth:** requireAuth(req)
- **Input schema:**
  ```ts
  const ParseExpenseSchema = z.object({
    text: z.string().min(1).max(2000),
    groupMembers: z.array(z.object({
      id: z.string().uuid(),
      name: z.string(),
    })).optional(),
    currency: z.string().length(3).default('INR'),
  });
  ```
- **Response schema:**
  ```ts
  type ParseExpenseResponse = {
    description: string;
    amount: number | null;
    currency: string;
    category: ExpenseCategory | null;
    splitType: SplitType;
    paidByName: string | null;
    splitWith: string[]; // member names matched
    confidence: number;  // 0-1
  };
  ```
- **Claude call requirements:**
  - prompt_version: `expense-parser-v1.0`
  - agent_name: `expense-parser`
  - Token logging via logAgentMetric
  - User text placed in human turn only (prompt injection guard)

#### New Route: POST /api/push-tokens

Registers or updates a push notification token.

- **Auth:** requireAuth(req)
- **Input schema:**
  ```ts
  const RegisterPushTokenSchema = z.object({
    token: z.string().min(1),
    platform: z.enum(['ios', 'android', 'web']),
    deviceId: z.string().optional(),
  });
  ```
- **Response:** 201 on create, 200 on update

#### New Route: DELETE /api/push-tokens

Deactivates a push token (on logout).

- **Auth:** requireAuth(req)
- **Input schema:**
  ```ts
  const DeactivatePushTokenSchema = z.object({
    token: z.string().min(1),
  });
  ```

#### Modified Routes (for push notification triggers)

The following existing routes need non-blocking push notification sends added after their main operation:

- `POST /api/expenses` -- notify group members of new expense
- `POST /api/settlements` -- notify payee of settlement received
- `POST /api/groups/[id]/members` -- notify existing members of new member

Pattern:
```ts
sendPushNotification({ userIds, title, body, data }).catch(console.error);
```

### 4.3 Frontend

#### Feature 1: Mobile Split Type UI

**Modified components:**
- `src/mobile/components/split-type-picker.tsx` -- Already renders all three types from `SPLIT_TYPES` constant. No change needed here since it already maps over `['equal', 'exact', 'percentage']`.
- `src/mobile/app/(tabs)/groups/[id]/add-expense.tsx` -- Add split detail inputs below SplitTypePicker
- `src/mobile/app/(modals)/expenses/new.tsx` -- Same split detail inputs

**New component:**
- `src/mobile/components/split-detail-input.tsx` -- Reusable component showing per-member amount/percentage inputs

**UI wireframe:**
When splitType is 'exact' or 'percentage':
- Below the SplitTypePicker, show a list of group members (or selected friends for direct expenses)
- Each row: [Avatar] [Name] [TextInput for amount or percentage]
- Below the list: a summary row showing "Total: X / Y" (for exact) or "Total: X% / 100%" (for percentage)
- Validation: amounts must sum to total, percentages must sum to 100
- For 'equal' split: show computed per-person amount as read-only text (matching web behavior)

**State management:**
- New state: `splitAmounts: Record<string, string>` (userId -> input string)
- Validation on submit: sum check with 0.01 tolerance
- Pass `splits` array to API when splitType !== 'equal'

#### Feature 3: Mobile Settlement Status

**Modified components:**
- `src/mobile/app/(tabs)/groups/[id]/settle.tsx` -- Add status badges to debt cards, add settlement history section

**New component:**
- `src/mobile/components/settlement-status-badge.tsx` -- Renders colored badge for pending/confirmed/disputed

**New hook:**
- `src/mobile/hooks/use-update-settlement.ts` -- Mutation hook calling PATCH /api/settlements/[id]

**UI wireframe:**
- Settlement history section below the debts list
- Each settlement card shows: payer -> payee, amount, date, status badge
- Tapping a settlement where user is a party shows an ActionSheet with "Confirm" / "Dispute" options
- After status change: invalidate balances and settlements queries

#### Feature 4: Web Dark Mode

**Modified files:**
- `src/web/tailwind.config.js` -- Add `darkMode: 'class'` and dark color tokens
- `src/web/app/globals.css` -- Convert hardcoded colors to CSS custom properties, add dark variants
- `src/web/app/layout.tsx` -- Add theme script in `<head>`, wrap with ThemeProvider
- `src/web/app/profile/page.tsx` -- Add appearance toggle (Light/Dark/System)

**New files:**
- `src/web/lib/theme.ts` -- Theme context, provider, useTheme hook, localStorage persistence
- `src/web/components/theme-toggle.tsx` -- Reusable toggle component

**CSS variable approach:**
```css
:root {
  --color-surface: #FFFFFF;
  --color-surface-raised: #FFFFFF;
  --color-surface-sunken: #F5F5F5;
  --color-ink: #1A1A1A;
  --color-ink-secondary: #6B6B6B;
  --color-ink-muted: #9CA3AF;
  /* ... all current tailwind color values */
}

.dark {
  --color-surface: #1a1a2e;
  --color-surface-raised: #2d2d44;
  --color-surface-sunken: #16162a;
  --color-ink: #ffffff;
  --color-ink-secondary: #a0aec0;
  --color-ink-muted: #718096;
  /* ... dark variants matching mobile DARK_COLORS */
}
```

**Flash prevention script (in layout.tsx `<head>`):**
```tsx
<script dangerouslySetInnerHTML={{ __html: `
  (function() {
    var theme = localStorage.getItem('hk-theme');
    if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    }
  })();
`}} />
```

**Tailwind config changes:**
```js
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: 'var(--color-surface)',
          raised: 'var(--color-surface-raised)',
          sunken: 'var(--color-surface-sunken)',
        },
        ink: {
          DEFAULT: 'var(--color-ink)',
          secondary: 'var(--color-ink-secondary)',
          muted: 'var(--color-ink-muted)',
        },
        // accent, gold, success, danger remain static (brand colors)
      },
    },
  },
};
```

#### Feature 5: Sync Conflict Resolution UI

**New files:**
- `src/mobile/app/(tabs)/profile/conflicts.tsx` -- Conflicts list screen
- `src/mobile/components/conflict-card.tsx` -- Single conflict display with diff view

**Navigation:**
- Add a "Sync Conflicts (N)" row in the profile screen, visible when unacknowledged conflicts exist
- Tapping navigates to the conflicts list

**UI wireframe:**
- List of unacknowledged conflicts from local `sync_conflicts` table
- Each card shows: table name, record ID, timestamp, resolution applied
- Expandable diff: local data vs server data (JSON formatted)
- "Acknowledge" button marks as acknowledged (sets `acknowledged = 1`)
- Empty state: "No conflicts" with checkmark

**Data access:**
- Direct SQLite queries (this is local-only data, no server round-trip)

#### Feature 6: AI Expense Parsing on Mobile

**New files:**
- `src/mobile/components/ai-expense-input.tsx` -- Text input with "magic wand" icon + camera button
- `src/web/app/api/ai/parse-expense/route.ts` -- Server-side Claude parsing route
- `src/services/src/queries/ai-parse.ts` -- Claude client wrapper with prompt versioning + logging

**Modified files:**
- `src/mobile/app/(tabs)/groups/[id]/add-expense.tsx` -- Add AI input section above the form
- `src/mobile/app/(modals)/expenses/new.tsx` -- Same AI input section

**UI wireframe:**
- At the top of the add-expense form, a collapsible "Smart Input" section
- TextInput with placeholder: "Try: dinner with Rahul 500"
- Submit button (sparkle icon) sends text to /api/ai/parse-expense
- On success: auto-fills description, amount, category, splitType fields
- Loading state: pulsing animation on the input
- Error state: inline error message, form still usable manually
- Camera button: opens camera, captures image, sends to OCR (Phase 2 -- text only for Phase 1)

**Claude prompt design:**
- System prompt: structured extraction instructions with INR assumption
- Human turn: user's raw text (sanitized)
- Output: JSON matching ParseExpenseResponse schema
- Zod validation on Claude's output before using it
- prompt_version: `expense-parser-v1.0`

#### Feature 7: Push Notifications on Mobile

**New files:**
- `src/mobile/lib/notifications.ts` -- Registration, permission request, token management
- `src/web/app/api/push-tokens/route.ts` -- Token registration API
- `src/web/lib/push-sender.ts` -- Server-side Expo push notification sender
- `src/services/src/queries/push-tokens.ts` -- DB operations for push_tokens table

**Modified files:**
- `src/mobile/app/_layout.tsx` -- Register for push notifications after login
- `src/web/app/api/expenses/route.ts` -- Add notification send after expense creation
- `src/web/app/api/settlements/route.ts` -- Add notification send after settlement creation
- `src/web/app/api/groups/[id]/members/route.ts` -- Add notification send after member added

**Registration flow:**
1. On app launch (after auth), request notification permissions
2. Get Expo push token via `Notifications.getExpoPushTokenAsync()`
3. POST token to /api/push-tokens
4. On logout, DELETE /api/push-tokens to deactivate

**Server-side send:**
- Use Expo Push API (`https://exp.host/--/api/v2/push/send`)
- Batch send to all active tokens for target users
- Non-blocking: `sendPushNotification(...).catch(console.error)`

### 4.4 Cross-Cutting Concerns

**Error handling:**
- AI parsing failures are non-fatal -- user can always fill in manually
- Push notification failures are non-blocking -- logged but never block the main operation
- Settlement status update errors show Alert on mobile with retry option

**Activity logging:**
- Settlement status changes should log activity (non-blocking)
- AI parse calls are logged to agent_metrics (mandatory per CLAUDE.md)

**Performance:**
- AI parsing: expect 1-3 second latency. Show clear loading state.
- Push token registration: fire-and-forget on login, retry on next app launch if failed
- Dark mode: CSS variables are computed once, no JS overhead on re-render

**Cache invalidation:**
- Mobile: React Query invalidation on mutation success (existing pattern)
- Web: `router.refresh()` after settlement status changes
- Web dark mode: localStorage for persistence, no server state

---

## 5. File Change Manifest

### Phase 1: Infrastructure (must complete first)

#### db-agent
1. `src/supabase/migrations/20260330000000_add_push_tokens.sql` -- CREATE push_tokens table with RLS
2. `src/services/src/queries/push-tokens.ts` -- CRUD for push_tokens
3. `src/services/src/queries/ai-parse.ts` -- Claude client wrapper with prompt versioning + token logging
4. `src/services/src/types.ts` -- Add PushToken type
5. `src/services/src/index.ts` -- Export new functions and types

### Phase 2: Features (can be parallelized)

#### Feature 1: Exact & Percentage Splits (frontend-agent, mobile)
1. `src/mobile/components/split-detail-input.tsx` -- NEW: per-member split input component
2. `src/mobile/app/(tabs)/groups/[id]/add-expense.tsx` -- MODIFY: add split detail inputs, validation
3. `src/mobile/app/(modals)/expenses/new.tsx` -- MODIFY: add split detail inputs, validation

#### Feature 3: Settlement Status (frontend-agent, mobile + minor backend)
1. `src/mobile/components/settlement-status-badge.tsx` -- NEW: status badge component
2. `src/mobile/hooks/use-update-settlement.ts` -- NEW: mutation hook for PATCH /api/settlements/[id]
3. `src/mobile/hooks/use-settlements.ts` -- NEW: query hook for GET /api/settlements?groupId=X
4. `src/mobile/app/(tabs)/groups/[id]/settle.tsx` -- MODIFY: add status badges, settlement history, confirm/dispute actions

#### Feature 4: Dark Mode on Web (frontend-agent, web)
1. `src/web/lib/theme.ts` -- NEW: ThemeProvider, useTheme hook, localStorage persistence
2. `src/web/components/theme-toggle.tsx` -- NEW: toggle component
3. `src/web/tailwind.config.js` -- MODIFY: add darkMode: 'class', convert colors to CSS variables
4. `src/web/app/globals.css` -- MODIFY: add :root and .dark CSS variable blocks, update component classes
5. `src/web/app/layout.tsx` -- MODIFY: add flash-prevention script, wrap with ThemeProvider
6. `src/web/app/profile/page.tsx` -- MODIFY: add appearance toggle section

#### Feature 5: Sync Conflict Resolution (frontend-agent, mobile)
1. `src/mobile/app/(tabs)/profile/conflicts.tsx` -- NEW: conflicts list screen
2. `src/mobile/components/conflict-card.tsx` -- NEW: conflict display with diff view
3. `src/mobile/app/(tabs)/profile/index.tsx` -- MODIFY: add conflicts nav row with badge count
4. `src/mobile/lib/local-db.ts` -- MODIFY: add helpers for querying/acknowledging sync_conflicts

#### Feature 6: AI Expense Parsing (backend-agent + frontend-agent)
1. `src/web/app/api/ai/parse-expense/route.ts` -- NEW: Claude parsing API route
2. `src/mobile/components/ai-expense-input.tsx` -- NEW: smart input component
3. `src/mobile/app/(tabs)/groups/[id]/add-expense.tsx` -- MODIFY: add AI input section
4. `src/mobile/app/(modals)/expenses/new.tsx` -- MODIFY: add AI input section

#### Feature 7: Push Notifications (backend-agent + frontend-agent)
1. `src/web/app/api/push-tokens/route.ts` -- NEW: token registration/deactivation routes
2. `src/web/lib/push-sender.ts` -- NEW: Expo push API client
3. `src/mobile/lib/notifications.ts` -- NEW: permission request, token management
4. `src/mobile/app/_layout.tsx` -- MODIFY: add notification registration on login
5. `src/web/app/api/expenses/route.ts` -- MODIFY: add push notification after expense creation
6. `src/web/app/api/settlements/route.ts` -- MODIFY: add push notification after settlement creation
7. `src/web/app/api/groups/[id]/members/route.ts` -- MODIFY: add push notification after member added

### Phase 3: Tests

#### test-agent
1. `src/mobile/components/split-detail-input.test.tsx` -- Split input component tests
2. `src/mobile/components/settlement-status-badge.test.tsx` -- Badge render tests
3. `src/mobile/components/conflict-card.test.tsx` -- Conflict card render tests
4. `src/mobile/components/ai-expense-input.test.tsx` -- AI input component tests
5. `src/web/app/api/ai/parse-expense/route.test.ts` -- API route tests (auth, validation, success with fixture)
6. `src/web/app/api/push-tokens/route.test.ts` -- API route tests (auth, validation, CRUD)
7. `src/web/lib/theme.test.ts` -- Theme provider tests
8. `src/web/components/theme-toggle.test.tsx` -- Toggle render tests

---

## 6. Implementation Order & Parallelization

```
Week 1 (Infrastructure):
  [db-agent] Migration + push-tokens queries + ai-parse service

Week 1-2 (Parallel feature work):
  [frontend-agent-1] Feature 1: Mobile split types     (no backend dependency)
  [frontend-agent-2] Feature 4: Web dark mode           (no backend dependency)
  [frontend-agent-3] Feature 5: Sync conflict UI        (no backend dependency)
  [frontend-agent-4] Feature 3: Settlement status       (no backend dependency -- API exists)
  [backend-agent]    Feature 6: AI parse-expense route   (depends on db-agent for ai-parse service)
  [backend-agent]    Feature 7: Push token route + sender (depends on db-agent for migration)

Week 2-3 (Integration):
  [frontend-agent]   Feature 6: Mobile AI input UI      (depends on backend route)
  [frontend-agent]   Feature 7: Mobile notification reg  (depends on backend route)
  [backend-agent]    Feature 7: Wire push sends into existing routes

Week 3 (Testing):
  [test-agent] All test files
```

**Features that can be fully parallelized** (no inter-dependencies):
- Feature 1, Feature 3, Feature 4, Feature 5

**Features with sequential dependencies:**
- Feature 6: db-agent -> backend-agent -> frontend-agent
- Feature 7: db-agent -> backend-agent -> frontend-agent

---

## 7. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Claude API latency >3s for expense parsing | Poor UX, users abandon AI input | Show clear loading state, keep manual form always visible, consider timeout with graceful fallback |
| Expo push token expiry / invalid tokens | Silent notification failures | Implement token cleanup: on 4xx from Expo API, mark token inactive. Re-register on each app launch |
| Dark mode CSS variable migration breaks existing styles | Visual regressions on web | Map CSS variables 1:1 to current hardcoded values first. Diff screenshots before/after. Keep accent/brand colors static |
| Split amount rounding errors (0.01 off) | Users cannot submit expense | Use 0.01 tolerance on sum validation (matching web). Auto-adjust last member's amount to absorb rounding |
| Sync conflict resolution data loss | User loses local changes | Phase 1 is read-only (acknowledge only). Show both local and server data clearly. Phase 2 adds "keep local" option |
| Push notifications permission denied | Users never receive notifications | Graceful degradation -- app works fully without notifications. Show in-app prompt explaining value before system prompt |
| Multiple devices with stale push tokens | Duplicate or ghost notifications | Unique constraint on (user_id, token). Deactivate on logout. Prune inactive tokens older than 30 days |

---

## 8. Acceptance Criteria

### Feature 1: Exact & Percentage Splits on Mobile
- [ ] AC1.1: SplitTypePicker shows Equal, Exact, Percentage options (already works -- uses SPLIT_TYPES constant)
- [ ] AC1.2: Selecting "Exact" shows per-member amount inputs below
- [ ] AC1.3: Selecting "Percentage" shows per-member percentage inputs below
- [ ] AC1.4: Validation prevents submission when exact amounts do not sum to total (with 0.01 tolerance)
- [ ] AC1.5: Validation prevents submission when percentages do not sum to 100 (with 0.01 tolerance)
- [ ] AC1.6: For "Equal" split, computed per-person amount is shown as read-only
- [ ] AC1.7: Expense with exact/percentage split is correctly created via API and visible in group
- [ ] AC1.8: Works in both group expense (add-expense.tsx) and direct expense (new.tsx) screens

### Feature 3: Settlement Status on Mobile
- [ ] AC3.1: Settlement history section appears on the settle screen with status badges
- [ ] AC3.2: Status badges show correct colors: pending=gold, confirmed=green, disputed=red
- [ ] AC3.3: Tapping a settlement where user is payer or payee shows confirm/dispute options
- [ ] AC3.4: Confirming/disputing calls PATCH /api/settlements/[id] and updates the UI
- [ ] AC3.5: Non-party settlements do not show action options

### Feature 4: Web Dark Mode
- [ ] AC4.1: Web defaults to system preference (prefers-color-scheme)
- [ ] AC4.2: No flash of wrong theme on page load (script runs before paint)
- [ ] AC4.3: Toggle on profile page switches between Light/Dark/System
- [ ] AC4.4: Theme persists across sessions via localStorage
- [ ] AC4.5: All existing pages render correctly in dark mode (no invisible text, broken borders)
- [ ] AC4.6: Brand colors (accent orange) remain consistent across themes
- [ ] AC4.7: Dark mode color tokens approximately match mobile DARK_COLORS for brand consistency

### Feature 5: Sync Conflict Resolution
- [ ] AC5.1: Profile screen shows "Sync Conflicts (N)" row when unacknowledged conflicts exist
- [ ] AC5.2: Conflicts screen lists all unacknowledged conflicts with table name, timestamp, resolution
- [ ] AC5.3: Each conflict card can be expanded to show local vs server data diff
- [ ] AC5.4: "Acknowledge" button marks conflict as acknowledged and removes from count
- [ ] AC5.5: Empty state shown when no conflicts exist

### Feature 6: AI Expense Parsing
- [ ] AC6.1: POST /api/ai/parse-expense requires auth (401 without token)
- [ ] AC6.2: POST /api/ai/parse-expense validates input with Zod (400 on invalid)
- [ ] AC6.3: POST /api/ai/parse-expense returns structured expense data from Claude
- [ ] AC6.4: Claude call includes prompt_version: 'expense-parser-v1.0' in metadata
- [ ] AC6.5: Claude call result is logged to agent_metrics via logAgentMetric
- [ ] AC6.6: Claude output is validated with Zod before returning to client
- [ ] AC6.7: Mobile AI input component sends text and receives parsed result
- [ ] AC6.8: Parsed result auto-fills description, amount, category fields on mobile
- [ ] AC6.9: AI input failure does not block manual expense entry
- [ ] AC6.10: User text is placed in human turn only (prompt injection guard)

### Feature 7: Push Notifications
- [ ] AC7.1: push_tokens table exists with RLS enabled
- [ ] AC7.2: POST /api/push-tokens registers a token (requires auth, validates with Zod)
- [ ] AC7.3: DELETE /api/push-tokens deactivates a token
- [ ] AC7.4: Mobile app requests notification permissions and registers token on login
- [ ] AC7.5: Mobile app deactivates token on logout
- [ ] AC7.6: New expense creation sends push to group members (non-blocking)
- [ ] AC7.7: Settlement creation sends push to payee (non-blocking)
- [ ] AC7.8: Member added sends push to existing group members (non-blocking)
- [ ] AC7.9: Push notification failures do not affect the main API response
- [ ] AC7.10: Duplicate token registration is handled gracefully (upsert)
