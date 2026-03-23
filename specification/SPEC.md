# HisabKitab — Product & Technical Specification

> AI-first group expense splitter for the Indian market.
> "Hisab" = account/calculation, "Kitab" = book — Your expense book.

**Last updated:** 2026-03-23
**Status:** MVP shipped, iterating

---

## 1. Product Vision

HisabKitab is a lightweight expense-splitting app for friend groups, trips, roommates, and events. Unlike Splitwise, it optimizes for **zero friction**: users can add expenses via a simple mobile UI or web dashboard. Built for India first — INR formatting, familiar patterns from GPay/PhonePe.

---

## 2. Target Users & Platforms

| Platform | Priority | Status |
|----------|----------|--------|
| Web App (Next.js) | P0 | **SHIPPED** — hisabkitab-five.vercel.app |
| Android App (Expo) | P1 | **SHIPPED** — local builds, APK available |
| iOS App (Expo) | P1 | **SHIPPED** — simulator builds working |
| WhatsApp Bot | P2 | Webhook endpoint exists, not fully wired |

---

## 3. Core User Personas

- **Organizer (Group Admin)**: Creates the group, invites people, settles up. Usually the one who paid the most.
- **Participant**: Joins a group, views balance, adds expenses, marks settled.
- **Non-tech User**: Wants to add "paid 500 for dinner, split among 4" quickly — minimal forms.

---

## 4. Feature Spec — Implemented

### 4.1 Authentication
- **Google OAuth** via Supabase Auth (web + mobile)
- **Test account** for demo (`test@hisabkitab.app` / `test1234`)
- **Cookie-based sessions** for web (Supabase SSR)
- **Bearer token auth** for mobile (stored in Expo Secure Store)
- **Middleware** redirects unauthenticated users to login
- *Not implemented: Phone OTP, guest mode*

### 4.2 Groups
- Create named group (fixed to INR; currency selection UI has been removed)
- Add members via user search (by name or phone)
- View all groups with member count
- Group detail with members, expenses, balances, settlement history
- Archive group (soft delete)
- Rename group
- Admin role for group creator

### 4.3 Members
- Search and add members to groups
- View member list with avatars and names
- Admin vs member roles
- Active/inactive status tracking

### 4.4 Expenses
- **Group expenses**: Add expense within a group, auto-split among members
- **Direct expenses**: Add expense between two friends (no group required)
- **Split types**: Equal (default), Exact amounts, Percentage
- **Categories**: Food, Transport, Accommodation, Entertainment, Utilities, Shopping, Health, Travel, Groceries, Other
- **Soft delete** expenses (only by creator)
- **Pagination** support for expense lists
- *Not implemented: Receipt photo upload, AI-powered expense parsing, edit expense*

### 4.5 Balances & Settlements
- Per-member balance within a group (who owes whom, how much)
- **Simplified debt minimization** — minimize number of transactions
- Direct (friend-to-friend) bilateral balances across all groups
- **Record settlement** with payment method (Cash, Bank Transfer, Other)
- **Settlement status**: Pending, Confirmed, Disputed
- Settlement history with timestamps
- Mark expense splits as settled upon settlement
- *UPI payment method and UPI transaction ID tracking removed from the settlement UI; the `upi_transaction_id` column remains in the database for future use*

### 4.6 Activity Feed
- Chronological activity log across all groups
- **Activity types**: expense_added, expense_deleted, settlement_created, member_joined, group_created, group_renamed, group_archived
- Activities grouped by day (Today, Yesterday, weekday, date)
- Each activity links to the relevant group detail page
- Metadata stored as JSONB for rich display

### 4.7 User Profile
- Edit display name
- Dark/light theme toggle (mobile)
- Sign out with confirmation dialog and redirect to login screen
- *UPI ID field and currency selection removed from profile UI; `upi_id` and `default_currency` columns remain in the database for future use*

### 4.8 Android App Download (Web)
- "Get Android App" badge on landing page and dashboard
- QR code modal for APK download link
- Dedicated `/mobile` page with standalone QR code + download button
- Uses `@radix-ui/react-dialog` for accessible modal

### 4.9 Web Landing Page
- Hero section: "Split expenses, not friendships"
- Feature cards: AI-Powered Parsing, Smart Settlements, Built for Groups
- "How it works" steps: Create group → Add expenses → Settle up
- "Built for India" callout with "Every paisa, accounted for"
- "Get Android App" badge in navigation
- Redirects authenticated users to dashboard
- *UPI-specific messaging removed from landing page copy*

### 4.10 Mobile Home Tab (Dashboard)
- **Summary cards** — "You are owed" and "You owe" aggregate balances across all groups, displayed side-by-side at the top
- **Your Groups strip** — horizontal scrollable row of up to 6 groups, each showing avatar, name, and per-group balance (green / red)
- **People section** — per-person net balances aggregated across all groups; displays avatar, name, and color-coded balance (green when the person owes you, red when you owe them); empty state shows "All settled up!"
- **Settlements by Group section** — outstanding debts involving the current user, organized under group name headers; each debt row shows direction ("You owe X" or "X owes you") with amount; debts where the user owes include a "Settle" button that navigates to the group's settle screen
- **Recent Activity** — last 10 activity events with link to relevant group
- **Expandable FAB** — "+" button fixed at bottom-right (above tab bar); expands to reveal two actions: "Add Expense" (navigates to the direct/friend expense modal) and "Group Expense" (opens a group picker modal then navigates to the selected group's add-expense screen)
- **Group picker modal** — lists all user groups; if the user has exactly one group the picker is skipped and the app navigates directly; if the user has zero groups the FAB navigates to the create-group screen
- **Section order:** Summary Cards, Your Groups, People, Settlements by Group, Recent Activity
- Pull-to-refresh on the Home tab refreshes all sections (groups, activity, balances) simultaneously
- All sections respect the current theme (light/dark) via the shared theme system

### 4.11 AI Agent Observability
- `agent_metrics` table logs every Claude API call
- Fields: agent_name, prompt_version, input_tokens, output_tokens, latency_ms, success
- `analytics_daily` table for aggregated metrics
- Admin audit log for data changes

---

## 5. User Flows

### Add Group Expense
```
Open app → Select Group → Tap "+ Add Expense"
→ Fill (description, amount, category, split type) → Submit → Balances updated
```

### Add Direct Expense (from FAB)
```
Home tab → Tap "+" FAB → Tap "Add Expense" (Split with friends)
→ Direct expense modal → Fill (description, amount, friend) → Submit
```

### Add Group Expense (from FAB)
```
Home tab → Tap "+" FAB → Tap "Group Expense" (Within a group)
→ Group picker modal (skipped if 1 group, replaced by create-group if 0 groups)
→ Group add-expense screen → Fill form → Submit → Balances updated
```

### Settlement Flow
```
Group detail → "You owe Priya ₹850" → Tap "Settle"
→ Enter amount, method (Cash/Bank Transfer/Other), note → Record → Activity logged
```

### New Group Flow
```
Groups tab → "Create your first group" → Name → Create → Add members → Add expenses
```

### Add Member Flow
```
Group detail → "Add Member" button → Search by name/phone → Tap user → Added
```

---

## 6. Non-Functional Requirements

| Requirement | Target | Status |
|-------------|--------|--------|
| Load time (mobile) | < 2 seconds on 4G | Achieved |
| Offline support | PWA cache for read | Not implemented |
| Availability | 99.5% uptime | Vercel SLA |
| Data retention | Groups archived after 12mo inactivity | Schema supports, cron not set |
| Auth | Google OAuth | Implemented |
| Scale (initial) | Up to 10,000 users | Supabase free tier |

---

## 7. Technical Architecture

### 7.1 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTS                               │
│   Next.js Web App  │  Expo Mobile (iOS/Android)  │  WA Bot  │
└──────────────┬──────────────┴───────────────────┴──────────┘
               │ HTTPS (Cookie auth / Bearer token)
┌──────────────▼──────────────────────────────────────────────┐
│                   API LAYER (Next.js 14)                      │
│   /api/expenses  /api/groups  /api/users  /api/settlements   │
│   /api/activity  /api/friends  /api/webhooks                 │
│                                                              │
│   requireAuth → Zod validate → @hisabkitab/services → JSON  │
└──────────────┬──────────────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────────────┐
│              @hisabkitab/services (Data Layer)                │
│   queries/groups  queries/expenses  queries/balances         │
│   queries/settlements  queries/activity  queries/users       │
└──────────────┬──────────────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────────────┐
│                       Supabase                               │
│   Postgres (RLS)  +  Auth  +  Realtime  +  Storage          │
└──────────────────────────────────────────────────────────────┘
```

### 7.2 Tech Stack (Implemented)

| Layer | Technology | Version |
|-------|-----------|---------|
| **Build** | Turborepo | 2.3.0 |
| **Runtime** | Node.js | >= 20.x |
| **Language** | TypeScript | 5.4.5 |
| **Web Framework** | Next.js (App Router) | 14.2.15 |
| **Mobile Framework** | React Native + Expo | 0.76.9 / 52.0.0 |
| **Mobile Navigation** | Expo Router | 4.0.0 |
| **Mobile Styling** | NativeWind | 4.0.1 |
| **Web Styling** | TailwindCSS | 3.4.19 |
| **UI Components** | Radix UI | Various |
| **State (Mobile)** | Zustand | 4.5.2 |
| **Data Fetching** | React Query | 5.40.0 |
| **Validation** | Zod | 3.23.8 |
| **Database** | Supabase (Postgres) | 2.43.5 |
| **Auth** | Supabase Auth (Google OAuth) | — |
| **Web Hosting** | Vercel | — |
| **Mobile Builds** | Expo EAS + Local (Xcode/Android Studio) | — |
| **Testing** | Vitest + Playwright | 3.2.4 / 1.58.2 |
| **Package Manager** | npm | 10.8.2 |

### 7.3 Monorepo Structure

```
hisabkitab/
├── src/
│   ├── web/              # Next.js 14 (API + web UI)
│   ├── mobile/           # Expo React Native (iOS + Android)
│   ├── services/         # @hisabkitab/services — DB queries, types, client
│   ├── shared/           # @hisabkitab/shared — types, constants, utils
│   └── supabase/         # SQL migrations (6 files, immutable)
├── tech-design/          # Architecture decision records
├── specification/        # This file
├── docs/                 # HTML reports
├── .claude/              # AI agent configuration
├── turbo.json            # Build orchestration
├── vercel.json           # Deployment config
└── package.json          # Workspaces: ["src/*"]
```

---

## 8. Database Schema (Implemented)

### Core Tables (RLS enabled on all)

```sql
users (
  id           uuid PK, phone text, name text, avatar_url text,
  upi_id text, default_currency text DEFAULT 'INR',
  created_at timestamptz, updated_at timestamptz
)

groups (
  id           uuid PK, name text, description text, currency text DEFAULT 'INR',
  created_by   uuid FK→users, avatar_url text, is_archived boolean DEFAULT false,
  created_at timestamptz, updated_at timestamptz
)

group_members (
  id           uuid PK, group_id uuid FK→groups, user_id uuid FK→users,
  role text ('admin'|'member'), joined_at timestamptz, is_active boolean DEFAULT true
)

expenses (
  id           uuid PK, group_id uuid FK→groups (nullable for direct),
  description text, amount numeric(12,2), currency text, paid_by uuid FK→users,
  category text, split_type text ('equal'|'exact'|'percentage'),
  receipt_url text, notes text, created_by uuid FK→users,
  created_at timestamptz, updated_at timestamptz, deleted_at timestamptz
)

expense_splits (
  id           uuid PK, expense_id uuid FK→expenses, user_id uuid FK→users,
  amount numeric(12,2), percentage numeric, settled boolean DEFAULT false,
  created_at timestamptz
)

settlements (
  id           uuid PK, group_id uuid FK→groups (nullable for direct),
  payer_id uuid FK→users, payee_id uuid FK→users, amount numeric(12,2),
  currency text, status text ('pending'|'confirmed'|'disputed'),
  note text, upi_transaction_id text, payment_method text,
  created_at timestamptz, updated_at timestamptz
)

activity_log (
  id           uuid PK, group_id uuid FK→groups (nullable),
  actor_id uuid FK→users, type text, title text, description text,
  metadata jsonb, created_at timestamptz
)

agent_metrics (
  id           uuid PK, agent_name text, prompt_version text,
  input_tokens int, output_tokens int, latency_ms int,
  success boolean, error_message text, group_id uuid, user_id uuid,
  created_at timestamptz
)

analytics_daily (
  id uuid PK, date date, group_id uuid, new_expenses int,
  total_expense_amount numeric, ai_calls int, ai_tokens_used int,
  active_users int, created_at timestamptz
)

admin_audit_log (
  id uuid PK, actor_id uuid, action text, table_name text,
  record_id uuid, old_data jsonb, new_data jsonb, ip_address text,
  created_at timestamptz
)
```

---

## 9. API Routes (Implemented)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/groups` | List user's groups with balances |
| POST | `/api/groups` | Create group |
| GET | `/api/groups/[id]` | Group detail with members |
| PATCH | `/api/groups/[id]` | Rename or archive group |
| GET | `/api/groups/[id]/members` | List group members |
| POST | `/api/groups/[id]/members` | Add member |
| GET | `/api/groups/[id]/balances` | Compute simplified debts |
| GET | `/api/expenses` | List expenses (group or direct) |
| POST | `/api/expenses` | Create expense with splits |
| DELETE | `/api/expenses/[id]` | Soft-delete expense |
| GET | `/api/settlements` | List settlements |
| POST | `/api/settlements` | Record settlement |
| PATCH | `/api/settlements/[id]` | Update settlement status |
| GET | `/api/activity` | Activity feed |
| GET | `/api/users` | Get current user profile |
| PATCH | `/api/users` | Update user profile |
| GET | `/api/users/search` | Search users by name/phone |
| GET | `/api/friends/[userId]` | Friend detail + balance |
| GET/POST | `/api/webhooks/whatsapp` | WhatsApp webhook |

All routes follow: `requireAuth` → Zod validation → `@hisabkitab/services` → sanitized JSON response.

---

## 10. Hosting & Infrastructure

| Component | Service | Status |
|-----------|---------|--------|
| Web/API | Vercel (Hobby) | **Live** — hisabkitab-five.vercel.app |
| Database + Auth | Supabase (Free) | **Live** |
| Android Builds | Local + Expo EAS | **Working** |
| iOS Builds | Local (Xcode) | **Working** (simulator) |
| WhatsApp Bot | Meta Cloud API | Webhook endpoint exists |
| Monitoring | Agent metrics table | **Working** |

---

## 11. MVP Status

### Done
- [x] Supabase setup (auth, schema, RLS policies) — 6 migrations
- [x] Next.js web app with 19 API routes — deployed on Vercel
- [x] Expo mobile app with tab navigation — builds on Android + iOS
- [x] Google OAuth authentication (web + mobile)
- [x] Group CRUD (create, rename, archive, list, detail)
- [x] Member management (search, add, list with roles)
- [x] Expense creation with equal/exact/percentage splits
- [x] Direct (friend-to-friend) expenses
- [x] Balance calculation with simplified debt minimization
- [x] Settlement flow with Cash/Bank Transfer/Other payment methods (UPI removed from UI)
- [x] Activity feed with day grouping
- [x] User profile (name, theme); UPI ID and currency fields removed from UI
- [x] Android app download page with QR code (/mobile)
- [x] Web landing page with features and CTAs (UPI-specific copy removed)
- [x] Dark/light theme toggle (mobile)
- [x] INR-only currency display in all UIs (multi-currency data layer retained for future use)
- [x] Mobile Home tab: expandable FAB with "Add Expense" and "Group Expense" actions
- [x] Mobile Home tab: "People" section — per-person net balances aggregated across all groups
- [x] Mobile Home tab: "Settlements by Group" section — per-group debt list with Settle buttons
- [x] Mobile Home tab feature parity with web dashboard
- [x] 233 unit/integration tests (Vitest) + Maestro E2E flows
- [x] E2E login tests (Playwright)
- [x] AI agent observability (agent_metrics table)

### Not Yet Implemented
- [ ] Receipt photo upload (Supabase Storage ready)
- [ ] AI-powered expense parsing (Claude API integration planned)
- [ ] Push notifications (expo-notifications configured, not wired)
- [ ] Phone OTP authentication
- [ ] Guest mode (no sign-up required)
- [ ] Admin dashboard (/admin page)
- [ ] WhatsApp bot (webhook exists, handler not complete)
- [ ] Offline support / PWA caching
- [ ] Realtime subscriptions (Supabase Realtime available)
- [ ] Invite links for groups
- [ ] iOS TestFlight / Android Play Store distribution
- [ ] Edit expense (only delete implemented)

---

## 12. Key Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Monorepo structure | `src/` with Turborepo | Single repo, shared types, parallel builds |
| Web + API together | Next.js 14 App Router | API routes co-located with web UI |
| Mobile framework | Expo + React Native | One codebase for iOS + Android |
| Database | Supabase (Postgres + RLS) | Built-in auth, realtime, admin UI |
| Auth method | Google OAuth | No password resets, fast onboarding |
| Package naming | `@hisabkitab/services` | Clear data layer separation |
| Currency | INR only in UI; multi-currency in data layer | India-first; DB supports expansion without a migration |
| Split types | Equal/Exact/Percentage | Covers 99% of real-world splits |
| Soft deletes | `deleted_at` timestamp | Audit trail, undo capability |
| Agent workflow | Orchestrator + specialists | Consistent, traceable changes |
| Testing | Vitest + Playwright | Fast unit tests + real E2E flows |
| Deployment | Vercel (web) + Local (mobile) | Zero-config, fast iterations |
