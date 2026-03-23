# Mobile Dashboard Parity — Technical Design

**Status:** Draft
**Date:** 2026-03-23
**Author:** architect-agent

## 1. Overview

The mobile Home tab currently shows balance summary cards, a horizontal groups strip, and recent activity. The web dashboard additionally shows a "People" section (per-person balance aggregation across all groups) and a "Settlements by Group" section (per-group debt list with settle buttons). The mobile app also lacks a floating action button (FAB) for quick expense creation. This design adds all three to achieve feature parity.

## 2. Requirements

### Functional
- F1: FAB ("+" button) fixed at bottom-right of the Home tab, navigates to a group picker then add-expense flow.
- F2: "People" section aggregating per-person net balances across all groups, displayed as a vertical list with avatar, name, and net balance.
- F3: "Settlements by Group" section showing each group's outstanding debts involving the current user, with a "Settle" button on debts the user owes.
- F4: Sections appear in order: Summary Cards, Your Groups, People, Settlements by Group, Recent Activity.

### Non-Functional
- NF1: Works on both iOS and Android.
- NF2: Uses existing theme system (dark/light mode via `useTheme`).
- NF3: No new API endpoints — all data derived from existing hooks.
- NF4: Smooth scroll performance — no nested FlatLists inside ScrollView.

## 3. Design Decisions

### Decision 1: Data source for People section
- **Options considered:**
  A. New dedicated hook that fetches per-person balances from a new API endpoint.
  B. Derive from `useGroups()` data (which only has `yourBalance` per group, not per-person).
  C. Fetch `useGroupBalances(groupId)` for each group and aggregate client-side.
- **Chosen:** C
- **Rationale:** The web dashboard does exactly this — it calls `getGroupBalances` per group, then aggregates into a `personMap`. The `useGroupBalances` hook already exists and returns `Debt[]` with `fromUserId`, `fromName`, `toUserId`, `toName`, `amount`. We can iterate all groups, fetch balances for each, and merge into a person map. No new API needed.
- **Trade-offs:** Multiple queries (one per group) on mount. Mitigated by React Query caching and the fact that most users have fewer than 10 groups.

### Decision 2: Where to put the aggregation logic
- **Options considered:**
  A. Inline in the Home screen component.
  B. New custom hook `usePeopleBalances()` and `useGroupSettlements()`.
- **Chosen:** B
- **Rationale:** Keeps the Home screen readable and allows unit testing of the aggregation logic independently. The hooks compose existing `useGroups` + `useGroupBalances` hooks.

### Decision 3: FAB navigation target
- **Options considered:**
  A. FAB opens a modal group picker, then navigates to add-expense for selected group.
  B. FAB navigates to the Groups tab.
  C. FAB opens the first group's add-expense page directly.
- **Chosen:** A
- **Rationale:** The web app's FAB opens an add-expense flow. Since expenses require a group context, a quick group picker modal (or ActionSheet) is the best UX. If the user has only one group, skip the picker and go directly.

### Decision 4: Component structure for new sections
- **Options considered:**
  A. Inline everything in the Home screen file.
  B. Extract `PeopleSection`, `SettlementsSection`, and `FloatingActionButton` as separate component files.
- **Chosen:** B
- **Rationale:** Single responsibility per file. Keeps the Home screen orchestrating layout and each section self-contained. Also makes testing straightforward.

### Decision 5: Settle button navigation
- **Options considered:**
  A. Navigate to existing settle screen at `/(tabs)/groups/[id]/settle`.
  B. Inline settle confirmation from the Home tab.
- **Chosen:** A
- **Rationale:** Reuses existing settle page which already handles the full settlement flow with confirmation. Avoids duplicating mutation logic.

## 4. Architecture

### 4.1 Data Model Changes

None. All data comes from existing hooks.

### 4.2 API Layer

None. No new endpoints needed.

### 4.3 Frontend

#### New Hooks

**`src/mobile/hooks/use-people-balances.ts`**

```ts
// Composes useGroups() + useGroupBalances() for each group.
// Returns: { people: PersonBalance[], isLoading: boolean }
// where PersonBalance = { userId, name, youOwe, owesYou, net, currency }
```

- Calls `useGroups()` to get all groups.
- For each group, calls `useGroupBalances(groupId)` via `useQueries` (React Query parallel queries).
- Aggregates debts into a per-person map identical to the web dashboard logic.
- Also returns `groupSettlements` — an array of `{ group: GroupListItem, debts: Debt[] }` for the Settlements section, filtering to debts involving the current user.

#### New Components

**`src/mobile/components/fab.tsx`** — Floating Action Button
- Absolutely positioned at bottom-right (above tab bar).
- Circular, 56x56, uses `colors.primary` background.
- "+" icon (Ionicons `add` or plain Text).
- `onPress` callback prop.

**`src/mobile/components/people-section.tsx`** — People list
- Receives `people: PersonBalance[]` and `isLoading: boolean`.
- Renders section header "People".
- Each row: Avatar (left), name (center), net balance badge (right, green if owesYou > youOwe, red otherwise).
- Empty state: "All settled up!" card.

**`src/mobile/components/settlements-section.tsx`** — Settlements by group
- Receives `groupSettlements` array and current `userId`.
- Groups debts by group. Each group is a Card with group name header.
- Each debt row: "You owe X" or "X owes you" + amount + Settle button (only when user owes).
- Settle button navigates to `/(tabs)/groups/[id]/settle`.
- Empty state: "No pending settlements." card.

**`src/mobile/components/group-picker-modal.tsx`** — Modal for FAB
- Modal overlay with a list of the user's groups.
- On group select, navigates to `/(tabs)/groups/[id]/add-expense` and closes.
- If only 1 group, auto-selects.

#### Modified Files

**`src/mobile/app/(tabs)/index.tsx`** — Home screen
- Import new hooks and components.
- Add `usePeopleBalances()` hook call.
- Insert `<PeopleSection>` between "Your Groups" and "Recent Activity".
- Insert `<SettlementsSection>` between "People" and "Recent Activity".
- Add `<FloatingActionButton>` and `<GroupPickerModal>` with state toggle.
- Pass group balances refresh to `refetchAll`.

### 4.4 Cross-Cutting Concerns

- **Error handling:** Each new section handles loading/error states independently. If balance queries fail for a group, that group is skipped (graceful degradation, matching web behavior with `Promise.allSettled`).
- **Performance:** `useQueries` runs balance fetches in parallel. Results are cached by React Query. The aggregation runs in a `useMemo` keyed on the balance data.
- **Theme:** All new components use `useTheme()` and the `createStyles(colors)` pattern established in existing components.

## 5. File Change Manifest

### frontend-agent

Files ordered by dependency (hooks first, then components, then screen integration):

1. **`src/mobile/hooks/use-people-balances.ts`** — NEW. Custom hook composing `useGroups` + `useGroupBalances` to produce `people` and `groupSettlements` arrays.
2. **`src/mobile/components/fab.tsx`** — NEW. Reusable floating action button component.
3. **`src/mobile/components/people-section.tsx`** — NEW. People balance list section.
4. **`src/mobile/components/settlements-section.tsx`** — NEW. Settlements by group section.
5. **`src/mobile/components/group-picker-modal.tsx`** — NEW. Modal for selecting a group from the FAB.
6. **`src/mobile/app/(tabs)/index.tsx`** — MODIFY. Integrate all new sections and FAB into the Home tab.

### test-agent

7. **`src/mobile/hooks/use-people-balances.test.ts`** — NEW. Unit tests for aggregation logic.
8. **`src/mobile/components/fab.test.tsx`** — NEW. Render + press tests.
9. **`src/mobile/components/people-section.test.tsx`** — NEW. Render tests with various data states.
10. **`src/mobile/components/settlements-section.test.tsx`** — NEW. Render + navigate tests.
11. **`src/mobile/components/group-picker-modal.test.tsx`** — NEW. Render + selection tests.

## 6. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| N+1 queries: one `useGroupBalances` call per group | Slow load for users with many groups | React Query parallel fetches + caching. Most users have <10 groups. Can add a combined endpoint later if needed. |
| FAB overlaps content at bottom of scroll | User cannot tap last activity item | Add bottom padding (80px) to ScrollView `contentContainerStyle` to ensure content clears the FAB. |
| Balance aggregation flickers on partial data | Confusing intermediate states | Use `useMemo` and only compute when all balance queries are settled (not loading). Show skeleton/loading state until then. |
| Group picker modal on zero groups | Broken flow | If user has no groups, FAB navigates to group creation screen instead (`/(tabs)/groups/new`). |

## 7. Acceptance Criteria

1. Home tab displays a "People" section showing per-person net balances aggregated across all groups.
2. People section shows avatar, name, and color-coded balance (green for owed to you, red for you owe).
3. People section shows "All settled up!" when there are no outstanding balances.
4. Home tab displays a "Settlements by Group" section with group headers and per-debt rows.
5. Each debt row in Settlements shows "You owe [name]" or "[name] owes you" with the amount.
6. Debts where the current user owes show a "Settle" button that navigates to the group's settle screen.
7. A FAB ("+" button) is visible at the bottom-right of the Home tab on both iOS and Android.
8. Tapping the FAB opens a group picker modal; selecting a group navigates to that group's add-expense screen.
9. If the user has only one group, the FAB skips the picker and goes directly to add-expense.
10. If the user has zero groups, the FAB navigates to the create-group screen.
11. Section order is: Summary Cards, Your Groups, People, Settlements by Group, Recent Activity.
12. All new components respect the current theme (light/dark) via `useTheme()`.
13. Pull-to-refresh on the Home tab also refreshes People and Settlements data.
14. All existing tests continue to pass (zero regressions).
15. New components have corresponding test files with render tests.
