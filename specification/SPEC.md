# HisabKitab — Product & Technical Specification

> A simplified group expense splitter for the Indian market.
> "Hisab" = account/calculation, "Kitab" = book — Your expense book.

---

## 1. Product Vision

HisabKitab is a lightweight expense-splitting app for friend groups, trips, roommates, and events. Unlike Splitwise, it optimizes for **zero friction**: users can add expenses via a simple mobile UI. One non-technical admin manages the backend via a simple dashboard.

---

## 2. Target Users & Platforms

| Platform         | Priority |
|------------------|----------|
| Mobile Web       | P0 — PWA, works in any browser |
| Android App      | P1 — via React Native / Expo |
| iOS App          | P1 — via React Native / Expo |
| WhatsApp Bot     | P2 — expense entry via WA |

---

## 3. Core User Personas

- **Organizer (Group Admin)**: Creates the group, invites people, settles up. Usually the one who paid the most.
- **Participant**: Joins a group, views balance, adds expenses, marks settled.
- **Non-tech User**: Wants to add "paid 500 for dinner, split among 4" quickly — minimal forms.

---

## 4. Feature Spec

### 4.1 Groups
- Create a named group (e.g., "Goa Trip 2026", "Flat Expenses")
- Invite members via link or phone number
- Group currency setting (default INR)
- Group status: Active / Archived

### 4.2 Members
- Join via invite link (no forced sign-up — nickname + phone optional)
- Optional sign-up with Google or phone OTP
- Guest mode: name only, no account needed

### 4.3 Expenses
- Add expense: amount, description, who paid, split among whom
- Split types:
  - Equal (default)
  - Custom amounts
  - Percentages
- Categories: Food, Transport, Accommodation, Entertainment, Other
- Attach photo of receipt (optional)
- Edit / Delete expense (by creator or admin)

### 4.5 Balances & Settlements
- Per-person balance within a group: who owes whom and how much
- Simplified debt (minimize number of transactions)
- Mark settlement: "Rahul paid Priya ₹400 via UPI"
- Settlement history
- Activity logged on settlement (visible to all group members)

### 4.6 Admin Dashboard (for the 1 non-tech admin)
- View all groups
- Manually fix any data issues
- User management (remove spammer, merge duplicate users)
- Simple analytics: active groups, total expenses, MAU

### 4.7 Recent Activity Feed
- Chronological activity log across all groups the user belongs to
- Activity types:
  - Expense added (amount, description, who paid)
  - Expense deleted
  - Settlement recorded (who paid whom, amount)
  - Member joined a group
  - Group created
- Activities are group-scoped: all group members see the same activity
- Activities grouped by day (Today, Yesterday, weekday, date)
- Each activity links to the relevant group detail page

---

## 5. User Flows

### Primary Flow: Add an Expense
```
Open app → Select Group → Tap "+"
→ Fill form → Confirm → Expense saved → Balances updated
```

### Settlement Flow
```
Home → "You owe Priya ₹850" → Tap "Settle" →
Mark paid (UPI/Cash/etc.) → Activity logged for group
```

### New Group Flow
```
"+" → Name group → Share invite link → Members join → Add expenses
```

---

## 6. Non-Functional Requirements

| Requirement       | Target                              |
|-------------------|-------------------------------------|
| Load time (mobile)| < 2 seconds on 4G                   |
| Offline support   | View balances offline (PWA cache)   |
| Availability      | 99.5% uptime                        |
| Data retention    | Groups archived after 12mo inactivity |
| Auth              | Phone OTP + Google OAuth            |
| Scale (initial)   | Up to 10,000 users, 100 groups/day  |

---

## 7. Technical Architecture

### 7.1 Architecture Philosophy: Low-Code Backend

Since one non-technical person manages this, the architecture must be:
1. **Minimal operational overhead** — managed services only
2. **One codebase for all platforms** — React Native + Expo (iOS, Android, Web)
3. **Serverless** — no servers to manage

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTS                               │
│   React Native (Expo) App  │  PWA (Mobile Web)  │  WA Bot   │
└──────────────┬──────────────┴────────────────────┴──────────┘
               │ HTTPS
┌──────────────▼──────────────────────────────────────────────┐
│                     API LAYER                                │
│          Next.js API Routes (or Hono on Cloudflare)          │
│                                                              │
│   /expenses  /groups  /users  /settlements  /webhooks       │
└──────────────┬──────────────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────────────┐
│                       Supabase                               │
│         Database  +  Auth  +  Realtime  +  Storage           │
└──────────────────────────────────────────────────────────────┘
```

### 7.2 Tech Stack Decisions

#### Frontend — React Native + Expo
- **Why**: Single codebase for iOS, Android, and Web (PWA)
- **Expo Router**: File-based routing, works on all 3 platforms
- **NativeWind**: Tailwind CSS for React Native (consistent styling)
- **React Query / TanStack Query**: Data fetching, caching, optimistic updates
- **Zustand**: Lightweight global state management
- **expo-notifications**: Push notifications on iOS/Android

#### Backend — Next.js on Vercel (or Hono on Cloudflare Workers)
**Option A: Next.js (Recommended for simplicity)**
- API Routes as backend (serverless functions)
- Same repo as web frontend
- Deploy to Vercel (free tier generous, zero-config)

**Option B: Hono on Cloudflare Workers (Recommended for performance + cost)**
- Ultra-fast edge runtime
- Extremely cheap ($0 for most indie apps)
- Better for latency-sensitive mobile apps

#### Database — Supabase
- **Why**: Postgres + built-in Auth + Realtime + File Storage + Admin UI
- The non-tech admin can use Supabase Studio (table editor) to view/fix data
- Row-Level Security (RLS) for data isolation between groups
- Realtime subscriptions: balance updates push to all group members instantly
- Storage: receipt images

#### Activity Feed
- **In-app**: Group-scoped activity log stored in `activity_log` table
- **Push (iOS/Android, P1)**: Expo Push Notifications (free, handles both platforms)
- **WhatsApp (P2)**: Meta Cloud API or Twilio WhatsApp Sandbox

#### Admin Dashboard
- **Supabase Studio**: Built-in table editor — the non-tech admin can use this directly
- **Custom dashboard (optional)**: Retool or a simple `/admin` Next.js page with a password

---

## 8. Database Schema

```sql
-- Users
users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       text UNIQUE,
  email       text UNIQUE,
  name        text NOT NULL,
  avatar_url  text,
  created_at  timestamptz DEFAULT now()
)

-- Groups
groups (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  currency    text DEFAULT 'INR',
  invite_code text UNIQUE DEFAULT nanoid(),
  created_by  uuid REFERENCES users(id),
  archived_at timestamptz,
  created_at  timestamptz DEFAULT now()
)

-- Group Members
group_members (
  group_id    uuid REFERENCES groups(id),
  user_id     uuid REFERENCES users(id),
  nickname    text,                      -- display name within group
  is_admin    boolean DEFAULT false,
  joined_at   timestamptz DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
)

-- Expenses
expenses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    uuid REFERENCES groups(id),
  paid_by     uuid REFERENCES users(id),
  amount      numeric(12,2) NOT NULL,
  description text NOT NULL,
  category    text DEFAULT 'other',
  receipt_url text,
  created_by  uuid REFERENCES users(id),
  created_at  timestamptz DEFAULT now(),
  deleted_at  timestamptz
)

-- Expense Splits (who owes what for each expense)
expense_splits (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id  uuid REFERENCES expenses(id),
  user_id     uuid REFERENCES users(id),
  amount      numeric(12,2) NOT NULL     -- amount this user owes for this expense
)

-- Settlements
settlements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    uuid REFERENCES groups(id),
  paid_by     uuid REFERENCES users(id),
  paid_to     uuid REFERENCES users(id),
  amount      numeric(12,2) NOT NULL,
  method      text,                      -- 'upi', 'cash', 'bank'
  note        text,
  created_at  timestamptz DEFAULT now()
)
```

---

## 9. Hosting & Infrastructure

### Recommended Stack (Minimal Cost, Zero Ops)

| Component        | Service                  | Cost (Starter)         |
|------------------|--------------------------|------------------------|
| Web/API hosting  | Vercel                   | Free (Hobby tier)      |
| Database + Auth  | Supabase                 | Free (up to 500MB)     |
| File Storage     | Supabase Storage         | Free (1GB)             |
| Push Notifs      | Expo Push                | Free                   |
| App Distribution | Expo EAS                 | Free (limited builds)  |
| WhatsApp Bot     | Meta Cloud API           | Free (1000 msgs/mo)    |
| Domain           | Namecheap / Cloudflare   | ~$10/yr                |
| Monitoring       | Sentry (free tier)       | Free                   |

**Total monthly cost at 0-5k users: ~$0-10/month**

### When to upgrade (at scale)
- Supabase Pro ($25/mo) at 500MB DB or 50k users
- Vercel Pro ($20/mo) if bandwidth exceeds free tier
- Cloudflare Workers (alternative to Vercel, $5/mo flat)

---

## 10. Development Approach

### Recommended: Vibe Coding with Claude Code
Since AI bots handle majority of development:

1. **This spec** → Claude Code generates the entire project scaffold
2. **Supabase migrations** → AI writes SQL, applies via Supabase CLI
3. **API routes** → Claude generates CRUD endpoints
4. **UI components** → Claude generates screens from wireframe descriptions
5. **Testing** → Claude writes Playwright E2E tests

### Folder Structure
```
hisabkitab/
├── apps/
│   ├── mobile/          # React Native + Expo (iOS/Android/Web)
│   └── web/             # Next.js web app (or combined with mobile via Expo Router)
├── packages/
│   ├── db/              # Supabase client, types, queries
│   └── shared/          # Shared types, utils, constants
├── supabase/
│   └── migrations/      # SQL migrations
└── SPEC.md              # This file
```

### Monorepo Tool: Turborepo
- Manages multiple packages in one repo
- Shared TypeScript types between frontend and backend
- Parallel builds

---

## 11. MVP Scope (Ship in 4-6 Weeks)

### Week 1-2: Foundation
- [ ] Supabase setup (auth, schema, RLS policies)
- [ ] Expo app scaffold with Expo Router
- [ ] Group creation + invite link
- [ ] Expense form
- [ ] Balance calculation logic

### Week 3-4: Core Features
- [ ] Settlement flow
- [ ] Direct (friend-to-friend) expenses
- [ ] Receipt photo upload
- [ ] Push notifications

### Week 5-6: Polish & Ship
- [ ] PWA configuration for mobile web
- [ ] Admin dashboard (/admin page + Supabase Studio)
- [ ] Expo EAS build (iOS TestFlight + Android Play Store internal)
- [ ] WhatsApp bot (basic version)

---

## 12. Key Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| One codebase or separate | One (Expo) | Admin is non-technical, fewer repos |
| SQL or NoSQL | PostgreSQL (Supabase) | Relational data fits expense splits perfectly |
| REST or GraphQL | REST (simple CRUD) | Simpler, AI can generate easily |
| Native or Web-first | Expo (both) | Single codebase = less maintenance |
| Auth method | OTP + Google | No password resets to manage |
| Currency | INR default, multi-currency later | Target market is India |
| Offline support | PWA cache for read, queue writes | Mobile users on flaky connections |
