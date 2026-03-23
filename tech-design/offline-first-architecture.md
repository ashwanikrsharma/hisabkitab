# Offline-First Architecture -- Technical Design

**Status:** Draft
**Date:** 2026-03-23
**Author:** architect-agent

## 1. Overview

HisabKitab's mobile app currently requires network connectivity for every operation. Users on poor Indian mobile networks (2G/3G, metro tunnels, rural areas) experience loading spinners, failed requests, and data loss. This design introduces an offline-first architecture where all user operations write to a local SQLite database immediately, then sync to the server in the background. The user never waits on the network for local operations.

## 2. Requirements

### Functional
- R1: All operations (create group, add expense, add member, settle, edit profile) work without network
- R2: Background sync when online -- on foreground, on timer (30s), on reconnect
- R3: Local-first writes -- UI reads from local DB, never blocks on network
- R4: Conflict resolution with last-write-wins (LWW) using `updated_at` timestamps
- R5: Sync conflicts surfaced to user via conflict log and UI indicators
- R6: Persistent Google login via Expo Secure Store with auto-refresh

### Non-Functional
- Sync queue survives app restart and crash (persisted to SQLite)
- No data loss -- partial syncs must not corrupt local or remote state
- Sync must not duplicate records (idempotent operations using server-assigned UUIDs vs local UUIDs)
- Battery-efficient -- no aggressive polling, use NetInfo events
- Local DB size target: < 50MB for a power user (1000 expenses, 50 groups)

## 3. Design Decisions

### Decision 1: Local Database -- expo-sqlite

- **Options considered:**
  - A) `expo-sqlite` -- SQLite via Expo, SQL-based, mature, ships with Expo SDK
  - B) `@op-engineering/op-sqlite` -- Faster SQLite, but requires custom native module
  - C) `WatermelonDB` -- Reactive ORM with built-in sync, but heavy abstraction, complex setup
  - D) `react-native-mmkv` -- Key-value only, no relational queries

- **Chosen:** A -- `expo-sqlite`
- **Rationale:** Already compatible with Expo SDK 52 (no custom native modules needed). SQL-based means we can mirror the Postgres schema exactly. Simpler mental model than WatermelonDB -- our data model is straightforward relational data, not a complex document graph. The team already knows SQL from the Supabase/Postgres work.
- **Trade-offs:** No built-in sync protocol (we build our own). No reactive queries out of the box (we use React Query's invalidation instead). Slightly slower than op-sqlite for bulk operations, but acceptable for our data volumes.

### Decision 2: Sync Strategy -- Custom Sync Queue + Pull/Push

- **Options considered:**
  - A) Custom sync queue with JSON operations in SQLite
  - B) WatermelonDB sync protocol
  - C) Supabase Realtime subscriptions + local cache
  - D) Custom CRDT implementation

- **Chosen:** A -- Custom sync queue
- **Rationale:** Simplest approach that meets all requirements. Our data model has clear ownership boundaries (user creates expense, user joins group) making conflicts rare. A queue of pending mutations is easy to reason about, debug, and monitor. Supabase Realtime (option C) only handles server-to-client -- it does not solve offline writes. CRDTs (option D) are overkill for V1 given our data patterns.
- **Trade-offs:** We must implement retry logic, conflict detection, and queue persistence ourselves. But the total complexity is lower than adopting WatermelonDB's opinions about data modeling.

### Decision 3: Conflict Resolution -- Last-Write-Wins (LWW) with Timestamp

- **Options considered:**
  - A) Last-write-wins using `updated_at` timestamp
  - B) Server-wins (server always authoritative)
  - C) Client-wins (client always authoritative)
  - D) Three-way merge / CRDT

- **Chosen:** A -- LWW with `updated_at`
- **Rationale:** HisabKitab's operations are mostly *additive* (create expense, create settlement, add member). True conflicts (two users editing the same expense simultaneously) are extremely rare because expenses are typically created by one person and are immutable after creation (no edit feature yet). LWW is simple, predictable, and covers the 99% case. When a conflict does occur, we log it for the user.
- **Trade-offs:** In the rare case of a true conflict, the later write wins silently. We mitigate this by logging conflicts to a local `sync_conflicts` table and showing a UI indicator.

### Decision 4: Auth Persistence -- Expo Secure Store

- **Options considered:**
  - A) Expo Secure Store for tokens + auto-refresh
  - B) AsyncStorage (unencrypted)
  - C) Supabase default (AsyncStorage adapter)

- **Chosen:** A -- Expo Secure Store
- **Rationale:** Tokens are sensitive credentials. Secure Store uses iOS Keychain / Android Keystore, which is hardware-backed encryption. The current implementation uses Supabase's default in-memory session which is lost on app restart. We need to configure Supabase's `auth.storage` to use Secure Store so sessions persist.
- **Trade-offs:** Secure Store has a 2KB value limit on some Android devices. We store only `access_token` and `refresh_token` (well under 2KB). Slightly slower reads than MMKV, but auth checks happen once at app start.

### Decision 5: Sync Trigger Strategy

- **Options considered:**
  - A) App foreground + timer + reconnect event
  - B) Only on explicit user pull-to-refresh
  - C) Aggressive real-time (every mutation immediately)

- **Chosen:** A -- Multi-trigger (foreground + 30s timer + reconnect)
- **Rationale:** Balances battery life with data freshness. The 30s timer only runs while the app is in the foreground and the device is online. Reconnect events use `@react-native-community/netinfo` which is already a transitive dependency.
- **Trade-offs:** Data can be up to 30 seconds stale from other users' changes. Acceptable for an expense app -- users don't need real-time updates on others' expenses.

## 4. Architecture

### 4.1 High-Level Architecture

```
+-----------------------------------------------------------+
|                    MOBILE APP (Expo)                       |
|                                                            |
|  +-----------+    +-------------+    +-----------------+   |
|  |   UI      |--->| React Query |--->| Local DB        |   |
|  | (Screens) |    | (Cache)     |    | (expo-sqlite)   |   |
|  +-----------+    +------+------+    +--------+--------+   |
|                          |                    |             |
|                          |    +---------------+             |
|                          |    |                             |
|                   +------v----v------+                      |
|                   |   Sync Engine    |                      |
|                   |  - Push queue    |                      |
|                   |  - Pull changes  |                      |
|                   |  - Conflict log  |                      |
|                   +--------+---------+                      |
|                            |                                |
+----------------------------+--------------------------------+
                             | HTTPS (when online)
+----------------------------v--------------------------------+
|              EXISTING API LAYER (Next.js)                   |
|   /api/groups  /api/expenses  /api/settlements  /api/sync   |
+-------------------------------------------------------------+
```

### 4.2 Data Model -- Local SQLite Schema

The local database mirrors the server tables with these additions:
- `_sync_status` column on every table: `synced` | `pending` | `error`
- `_local_id` column: local UUID assigned before sync (maps to server `id` after sync)
- `_updated_at_local` column: client-side timestamp for LWW

```sql
-- Local schema (expo-sqlite, created on app first launch)

CREATE TABLE IF NOT EXISTS local_users (
  id TEXT PRIMARY KEY,                    -- server UUID (set after sync or from pull)
  phone TEXT,
  name TEXT NOT NULL,
  avatar_url TEXT,
  upi_id TEXT,
  default_currency TEXT DEFAULT 'INR',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  _sync_status TEXT DEFAULT 'synced' CHECK(_sync_status IN ('synced','pending','error')),
  _last_synced_at TEXT
);

CREATE TABLE IF NOT EXISTS local_groups (
  id TEXT PRIMARY KEY,                    -- server UUID or local temp UUID
  name TEXT NOT NULL,
  description TEXT,
  currency TEXT DEFAULT 'INR',
  created_by TEXT NOT NULL,
  avatar_url TEXT,
  is_archived INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  _sync_status TEXT DEFAULT 'synced' CHECK(_sync_status IN ('synced','pending','error')),
  _local_id TEXT,                         -- temp UUID used before server assigns real ID
  _last_synced_at TEXT
);

CREATE TABLE IF NOT EXISTS local_group_members (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT DEFAULT 'member',
  joined_at TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  _sync_status TEXT DEFAULT 'synced' CHECK(_sync_status IN ('synced','pending','error')),
  _local_id TEXT,
  _last_synced_at TEXT,
  FOREIGN KEY (group_id) REFERENCES local_groups(id)
);

CREATE TABLE IF NOT EXISTS local_expenses (
  id TEXT PRIMARY KEY,
  group_id TEXT,
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL,
  paid_by TEXT NOT NULL,
  category TEXT,
  split_type TEXT NOT NULL,
  receipt_url TEXT,
  notes TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  _sync_status TEXT DEFAULT 'synced' CHECK(_sync_status IN ('synced','pending','error')),
  _local_id TEXT,
  _last_synced_at TEXT
);

CREATE TABLE IF NOT EXISTS local_expense_splits (
  id TEXT PRIMARY KEY,
  expense_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  amount REAL NOT NULL,
  percentage REAL,
  settled INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  _sync_status TEXT DEFAULT 'synced' CHECK(_sync_status IN ('synced','pending','error')),
  _local_id TEXT,
  _last_synced_at TEXT,
  FOREIGN KEY (expense_id) REFERENCES local_expenses(id)
);

CREATE TABLE IF NOT EXISTS local_settlements (
  id TEXT PRIMARY KEY,
  group_id TEXT,
  payer_id TEXT NOT NULL,
  payee_id TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  note TEXT,
  upi_transaction_id TEXT,
  payment_method TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  _sync_status TEXT DEFAULT 'synced' CHECK(_sync_status IN ('synced','pending','error')),
  _local_id TEXT,
  _last_synced_at TEXT
);

CREATE TABLE IF NOT EXISTS local_activity_log (
  id TEXT PRIMARY KEY,
  group_id TEXT,
  actor_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata TEXT,                          -- JSON string
  created_at TEXT NOT NULL,
  _sync_status TEXT DEFAULT 'synced' CHECK(_sync_status IN ('synced','pending','error'))
);

-- Sync infrastructure tables

CREATE TABLE IF NOT EXISTS sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operation TEXT NOT NULL,                -- 'create' | 'update' | 'delete'
  table_name TEXT NOT NULL,               -- 'groups' | 'expenses' | etc.
  record_id TEXT NOT NULL,                -- local ID of the record
  payload TEXT NOT NULL,                  -- JSON of the mutation data
  created_at TEXT NOT NULL,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 5,
  last_error TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','in_progress','failed','completed'))
);

CREATE TABLE IF NOT EXISTS sync_conflicts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  local_data TEXT NOT NULL,               -- JSON snapshot of local version
  server_data TEXT NOT NULL,              -- JSON snapshot of server version
  resolution TEXT NOT NULL,               -- 'server_wins' | 'client_wins' | 'merged'
  resolved_at TEXT NOT NULL,
  acknowledged INTEGER DEFAULT 0          -- user has seen this conflict
);

CREATE TABLE IF NOT EXISTS sync_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- Stores: 'last_pull_timestamp', 'device_id', 'sync_version'

CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
CREATE INDEX IF NOT EXISTS idx_sync_queue_table ON sync_queue(table_name);
CREATE INDEX IF NOT EXISTS idx_local_expenses_group ON local_expenses(group_id);
CREATE INDEX IF NOT EXISTS idx_local_expense_splits_expense ON local_expense_splits(expense_id);
CREATE INDEX IF NOT EXISTS idx_local_group_members_group ON local_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_local_groups_sync ON local_groups(_sync_status);
CREATE INDEX IF NOT EXISTS idx_local_expenses_sync ON local_expenses(_sync_status);
```

### 4.3 Sync Protocol

#### 4.3.1 Push (Client to Server)

When the sync engine runs, it processes the `sync_queue` table FIFO:

```
1. SELECT * FROM sync_queue WHERE status = 'pending' ORDER BY id ASC LIMIT 10
2. For each entry:
   a. Set status = 'in_progress'
   b. POST /api/sync/push with { operations: [...] }
   c. On success:
      - Set status = 'completed'
      - Update local record: _sync_status = 'synced', id = server_id (if new)
      - Update _local_id -> server_id mapping in local_id_map
   d. On 409 conflict:
      - Fetch server version, compare updated_at
      - Apply LWW, log to sync_conflicts
      - Set status = 'completed'
   e. On network error:
      - Increment retry_count
      - If retry_count >= max_retries, set status = 'failed', _sync_status = 'error'
      - Otherwise, leave as 'pending' for next cycle
   f. On 4xx validation error:
      - Set status = 'failed', record last_error
      - Set _sync_status = 'error' on the local record
```

#### 4.3.2 Pull (Server to Client)

After push completes, pull new/changed data:

```
1. Read last_pull_timestamp from sync_metadata
2. GET /api/sync/pull?since={last_pull_timestamp}&tables=groups,expenses,...
3. Server returns all records where updated_at > since for the user's groups
4. For each returned record:
   a. If local record exists AND _sync_status = 'pending':
      - Compare updated_at. If server is newer, log conflict, apply server version
      - If local is newer, skip (will be pushed next cycle)
   b. If local record exists AND _sync_status = 'synced':
      - Upsert with server data
   c. If no local record:
      - Insert
5. Update last_pull_timestamp in sync_metadata
6. Invalidate React Query cache for affected query keys
```

#### 4.3.3 Sync Batch API (New Endpoints)

**POST /api/sync/push**

```ts
// Request
{
  device_id: string,
  operations: Array<{
    id: string,             // queue entry ID for idempotency
    operation: 'create' | 'update' | 'delete',
    table: string,
    record_id: string,      // local UUID
    data: Record<string, unknown>,
    client_updated_at: string
  }>
}

// Response
{
  results: Array<{
    queue_id: string,
    status: 'ok' | 'conflict' | 'error',
    server_id?: string,     // real server UUID (for creates)
    server_data?: Record<string, unknown>,  // for conflicts
    error?: string
  }>
}
```

**GET /api/sync/pull**

```ts
// Query params: since (ISO timestamp), tables (comma-separated)
// Response
{
  changes: {
    groups: Array<Group>,
    group_members: Array<GroupMember>,
    expenses: Array<Expense>,
    expense_splits: Array<ExpenseSplit>,
    settlements: Array<Settlement>,
    activity_log: Array<Activity>
  },
  timestamp: string   // use as next 'since'
}
```

### 4.4 API Layer Changes

Two new API routes for sync, plus modifications to existing routes for `updated_at` filtering.

**New route: POST /api/sync/push**
- `requireAuth(req)` -- first line
- Validates batch with Zod
- Processes each operation by delegating to existing `@hisabkitab/services` functions
- Returns per-operation status with server IDs
- Activity logging: non-blocking

**New route: GET /api/sync/pull**
- `requireAuth(req)` -- first line
- Accepts `since` timestamp and `tables` filter
- Queries each table for `updated_at > since` scoped to user's groups (via RLS + explicit group membership check)
- Returns changed records grouped by table

### 4.5 Frontend / Mobile Layer

#### 4.5.1 Local Database Module (`src/mobile/lib/local-db.ts`)

Initializes the SQLite database on app start, runs the schema creation, provides typed CRUD helpers:

```ts
// Pseudocode API
export function initLocalDb(): Promise<void>
export function getLocalGroups(userId: string): Promise<LocalGroup[]>
export function insertLocalGroup(group: LocalGroupInsert): Promise<void>
export function getLocalExpenses(groupId: string): Promise<LocalExpense[]>
export function insertLocalExpense(expense: LocalExpenseInsert): Promise<void>
// ... etc for each table
export function enqueueSyncOperation(op: SyncOperation): Promise<void>
export function getPendingSyncOps(): Promise<SyncOperation[]>
```

#### 4.5.2 Sync Engine (`src/mobile/lib/sync-engine.ts`)

Orchestrates push/pull cycles:

```ts
export function startSyncEngine(): () => void    // returns cleanup function
export function triggerSync(): Promise<void>      // manual trigger
export function getSyncStatus(): SyncStatus       // 'idle' | 'syncing' | 'error'
export function getPendingCount(): Promise<number>
export function getConflicts(): Promise<SyncConflict[]>
export function acknowledgeConflict(id: number): Promise<void>
```

#### 4.5.3 Offline-Aware Hooks (`src/mobile/hooks/use-offline-api.ts`)

New hooks that replace the current `use-api.ts` hooks. They read from local SQLite and write to local SQLite + sync queue:

```ts
// Reads from local DB, falls back gracefully
export function useGroups()          // SELECT from local_groups
export function useGroupDetail(id)   // SELECT from local_groups + local_group_members
export function useGroupExpenses(id) // SELECT from local_expenses

// Writes to local DB + enqueue sync
export function useCreateGroup()     // INSERT local_groups + enqueue push
export function useCreateExpense()   // INSERT local_expenses + local_expense_splits + enqueue push
export function useCreateSettlement() // INSERT local_settlements + enqueue push
```

#### 4.5.4 Auth Persistence (`src/mobile/store/auth.ts` modifications)

Replace the default Supabase storage adapter with Expo Secure Store:

```ts
import * as SecureStore from 'expo-secure-store';

const secureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: secureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,  // mobile does not use URL-based auth detection
  },
});
```

#### 4.5.5 Network Status Provider (`src/mobile/lib/network-status.ts`)

```ts
import NetInfo from '@react-native-community/netinfo';

export function subscribeToNetworkStatus(
  onOnline: () => void,
  onOffline: () => void
): () => void   // returns unsubscribe
export function isOnline(): Promise<boolean>
```

#### 4.5.6 Sync Status UI

A small indicator component shown in the tab bar or header:

- Green dot: all synced
- Yellow dot + count: N pending operations
- Red dot: sync error (tap to view details)
- Tapping opens a sync status sheet showing pending ops, conflicts, last sync time

### 4.6 Cross-Cutting Concerns

#### Error Handling
- Local DB errors: show toast, log to console.error, do not crash
- Sync errors: retry with exponential backoff (1s, 2s, 4s, 8s, 16s), cap at 5 retries
- Auth errors during sync (401): trigger token refresh, retry once. If still 401, mark as needing re-login
- Conflict errors: log to sync_conflicts, apply LWW, show indicator

#### ID Mapping
When a record is created offline, it gets a local UUID (generated via `expo-crypto` `randomUUID()`). After sync, the server returns the real UUID. The local record's `id` is updated, and all foreign key references are updated in the same SQLite transaction. The `_local_id` column preserves the original local UUID for debugging.

#### Transaction Safety
All local write operations (insert record + enqueue sync) happen in a single SQLite transaction. If either fails, both roll back. This ensures the sync queue and local data are always consistent.

#### Balance Computation
Balances are computed locally from `local_expenses` + `local_expense_splits` using the same `simplifyDebts` algorithm already in `src/services/src/queries/balances.ts`. This function is pure (no DB dependency) and lives in `@hisabkitab/shared`, so the mobile app can import it directly.

## 5. File Change Manifest

### Phase 1: Foundation (db-agent + backend-agent)

#### db-agent
- `src/supabase/migrations/20260323120000_add_sync_support.sql` -- Add `updated_at` index on all tables, add `device_id` column to relevant tables for conflict tracking

#### backend-agent
- `src/web/app/api/sync/push/route.ts` -- New: batch push endpoint
- `src/web/app/api/sync/pull/route.ts` -- New: incremental pull endpoint
- `src/services/src/queries/sync.ts` -- New: server-side sync query functions (bulk upsert, changed-since queries)
- `src/services/src/types.ts` -- Add sync-related types (SyncPushRequest, SyncPullResponse)
- `src/services/src/index.ts` -- Export new sync functions

### Phase 2: Mobile Offline Layer (frontend-agent)

#### frontend-agent (mobile)
- `src/mobile/lib/local-db.ts` -- New: SQLite database initialization + typed CRUD helpers
- `src/mobile/lib/local-db-schema.ts` -- New: SQL schema strings + migration logic
- `src/mobile/lib/sync-engine.ts` -- New: push/pull orchestration, retry logic, conflict resolution
- `src/mobile/lib/network-status.ts` -- New: NetInfo wrapper with online/offline callbacks
- `src/mobile/lib/id-mapping.ts` -- New: local UUID to server UUID mapping utilities
- `src/mobile/hooks/use-offline-api.ts` -- New: offline-first hooks replacing use-api.ts
- `src/mobile/hooks/use-sync-status.ts` -- New: hook exposing sync state to UI
- `src/mobile/store/auth.ts` -- Modify: add Secure Store adapter, persist sessions
- `src/mobile/components/sync-status-indicator.tsx` -- New: visual sync status dot
- `src/mobile/components/sync-status-sheet.tsx` -- New: bottom sheet with sync details + conflicts
- `src/mobile/app/_layout.tsx` -- Modify: initialize local DB + start sync engine on mount
- `src/mobile/app/(tabs)/groups/[id]/index.tsx` -- Modify: switch to offline hooks
- `src/mobile/app/(tabs)/groups/index.tsx` -- Modify: switch to offline hooks
- `src/mobile/app/(tabs)/groups/new.tsx` -- Modify: switch to offline hooks
- `src/mobile/app/(tabs)/groups/[id]/add-expense.tsx` -- Modify: switch to offline hooks
- `src/mobile/app/(tabs)/groups/[id]/add-member.tsx` -- Modify: switch to offline hooks
- `src/mobile/app/(tabs)/groups/[id]/settle.tsx` -- Modify: switch to offline hooks
- `src/mobile/app/(tabs)/activity/index.tsx` -- Modify: switch to offline hooks
- `src/mobile/app/(tabs)/profile/index.tsx` -- Modify: switch to offline hooks
- `src/mobile/app/(modals)/expenses/new.tsx` -- Modify: switch to offline hooks
- `src/mobile/app/(modals)/settle.tsx` -- Modify: switch to offline hooks
- `src/mobile/package.json` -- Add: `expo-sqlite`, `@react-native-community/netinfo`

### Phase 3: Shared Logic Extraction

- `src/shared/src/balance-calculator.ts` -- Move: extract `simplifyDebts` from services to shared so mobile can use it locally without importing server-side code

### Phase 4: Testing (mobile-test-agent)

- `src/mobile/lib/local-db.test.ts` -- Unit tests for CRUD operations
- `src/mobile/lib/sync-engine.test.ts` -- Unit tests for queue processing, conflict resolution
- `src/mobile/lib/id-mapping.test.ts` -- Unit tests for UUID mapping
- `src/web/app/api/sync/push/route.test.ts` -- API tests for push endpoint
- `src/web/app/api/sync/pull/route.test.ts` -- API tests for pull endpoint

## 6. Migration Plan (Online-Only to Offline-First)

### Step 1: Ship auth persistence (standalone, no other changes)
Modify `src/mobile/store/auth.ts` to use Secure Store. This is backward-compatible and immediately fixes the "logged out on restart" problem. Can be shipped independently.

### Step 2: Ship sync API endpoints
Add `/api/sync/push` and `/api/sync/pull` to the server. These are additive -- they do not change existing endpoints. Existing mobile versions continue to work.

### Step 3: Ship local DB + sync engine (behind feature flag)
Add the local database layer and sync engine. Use a feature flag (`EXPO_PUBLIC_OFFLINE_MODE=true`) to toggle between old hooks (`use-api.ts`) and new hooks (`use-offline-api.ts`). This allows gradual rollout and easy rollback.

### Step 4: Initial data hydration
On first launch with offline mode enabled, the app does a full pull (no `since` timestamp) to populate the local database. Progress indicator shows "Setting up offline mode..." with a progress bar. Subsequent launches only pull incremental changes.

### Step 5: Remove feature flag, deprecate use-api.ts
Once stable, remove the flag, delete `use-api.ts`, and make `use-offline-api.ts` the default (rename to `use-api.ts`).

## 7. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Clock skew between devices causes wrong LWW resolution | Medium -- wrong data wins conflict | Use server `updated_at` as source of truth during pull. Client timestamps are only used for local ordering. Server always assigns the canonical `updated_at` on write. |
| Large initial sync on first launch (user with 50 groups, 1000 expenses) | Medium -- slow first launch, battery drain | Paginate the initial pull (100 records per request). Show progress bar. Only pull groups the user is active in. Compress responses with gzip. |
| SQLite database corruption on crash | High -- data loss | Use WAL mode (`PRAGMA journal_mode=WAL`). Wrap all writes in transactions. Keep a `sync_queue` backup in MMKV as a secondary persistence layer for the most recent 10 operations. |
| expo-sqlite API changes in future Expo SDK | Low -- migration effort | Pin to Expo SDK 52. The schema creation SQL is standard and portable to any SQLite library. |
| Sync queue grows unbounded while offline for days | Medium -- slow sync, battery drain on reconnect | Cap queue at 500 operations. After 500, start dropping activity_log entries (lowest priority). Never drop expense or settlement operations. Warn user if queue is > 100. |
| Two devices create the same expense offline | Medium -- duplicate records | Each operation has a unique local UUID. The push endpoint checks for duplicates by matching (created_by, description, amount, created_at within 1 minute). Return existing record if duplicate detected. |
| Secure Store unavailable on some Android devices | Low -- auth fails | Fall back to AsyncStorage with a logged warning. Encrypt tokens manually with expo-crypto if Secure Store is unavailable. |
| Balance computation differs between local and server | High -- user sees wrong amounts | Extract `simplifyDebts` to `@hisabkitab/shared` so both server and mobile use the identical algorithm. After every pull, recompute local balances. |

## 8. Acceptance Criteria

1. User can create a group while in airplane mode; group appears in the groups list immediately with a "pending sync" indicator
2. User can add an expense while offline; expense appears in the group detail screen immediately
3. User can record a settlement while offline; balances update locally using the shared algorithm
4. When the device comes online, all pending operations sync to the server within 60 seconds
5. After sync, the "pending" indicators disappear and data matches the server
6. If the app is killed and restarted while offline, all previously created data is still present (persisted in SQLite)
7. If the sync queue has items and the app is killed, the queue is intact on restart and syncs when online
8. User stays logged in after killing and restarting the app (Secure Store persistence)
9. Expired auth tokens are automatically refreshed without user intervention
10. If a sync conflict occurs (same record modified on two devices), the conflict is logged and the user can view it in the sync status sheet
11. The sync status indicator shows green (synced), yellow (pending), or red (error) accurately
12. Balance amounts shown locally match what the server computes for the same data set (shared algorithm)
13. Creating an expense offline and then viewing the group on the web (after sync) shows the same expense with correct splits
14. The initial data hydration on first offline-mode launch completes within 10 seconds for a user with 10 groups and 100 expenses
15. No loading spinners are shown for local operations (reads from SQLite are synchronous from the UI perspective)

## 9. Dependencies to Install

```json
{
  "expo-sqlite": "~15.0.0",
  "@react-native-community/netinfo": "11.4.1",
  "expo-secure-store": "~14.0.0"
}
```

Note: `expo-secure-store` is already in `package.json`. `expo-sqlite` and `@react-native-community/netinfo` need to be added. Both are compatible with Expo SDK 52 and do not require custom native modules (they are included in the Expo prebuild).

## 10. Out of Scope for V1

- Real-time sync via WebSocket/Supabase Realtime (pull-based is sufficient for V1)
- Offline image/receipt storage (receipt upload is not yet implemented)
- Multi-device conflict merge UI (V1 just shows the conflict log)
- Offline user search (search requires server-side query; show "search requires internet" message)
- Sync compression / delta encoding (full records are fine at our data volumes)
- Background sync when app is not in foreground (iOS/Android background task APIs are unreliable)
