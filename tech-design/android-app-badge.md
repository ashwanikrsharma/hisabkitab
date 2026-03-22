# Android App Badge — Technical Design

**Status:** Approved
**Date:** 2026-03-22
**Author:** architect-agent

## 1. Overview

Add an "Install Android App" badge that appears on both the landing page (unauthenticated users) and the dashboard (authenticated users). Clicking the badge opens a modal dialog containing a QR code that links to the Android APK hosted on Google Drive. This is a frontend-only change with no database, API, or backend modifications.

## 2. Requirements

### Functional
- A visible badge/button labeled "Get Android App" (or similar) appears on the landing page and the dashboard
- Clicking the badge opens a modal dialog with a QR code
- The QR code encodes the URL: `https://drive.google.com/file/d/1ypl2yxz8TH1Z5EnunA2JmfJnj48O8Y8v/view?usp=drive_link`
- The modal includes a direct download link as a fallback (for users already on mobile who cannot scan)
- The modal can be closed via the X button, clicking outside, or pressing Escape

### Non-Functional
- Component renders without layout shift (fixed dimensions for QR image)
- QR code image loads from external API; a loading placeholder must be shown while it loads
- Accessible: dialog has proper ARIA attributes, focus trap, keyboard dismissal
- Mobile-first: badge and modal must look good on small screens

## 3. Design Decisions

### Decision 1: Radix Dialog vs Custom Modal
- **Options considered:** (A) Radix UI Dialog, (B) Custom modal with useState + portal, (C) HTML `<dialog>` element
- **Chosen:** A — Radix UI Dialog (`@radix-ui/react-dialog`)
- **Rationale:** Already installed in the project (`@radix-ui/react-dialog@^1.1.15`). Provides accessible focus trap, Escape key handling, outside-click dismissal, and proper ARIA attributes out of the box. Matches the existing dependency footprint without adding new libraries.
- **Trade-offs:** Slight bundle size from Radix primitives, but this is already paid since the package is a dependency.

### Decision 2: QR Code Generation — External API vs Client-Side Library
- **Options considered:** (A) External API (`api.qrserver.com`), (B) npm package like `qrcode.react`
- **Chosen:** A — External API
- **Rationale:** Zero additional dependencies. The QR code is static (URL never changes), so caching is effective. The API returns a PNG image that can be rendered with a standard `<img>` tag. No client-side JS cost for QR generation.
- **Trade-offs:** Dependency on a third-party service for image generation. Mitigated by the fact that the QR code URL is static and the image will be browser-cached. If the API is down, the direct link fallback still works.

### Decision 3: Single Shared Component vs Per-Page Components
- **Options considered:** (A) One shared `AndroidAppBadge` component imported into both pages, (B) Separate badge per page with different styling
- **Chosen:** A — Single shared component
- **Rationale:** DRY principle. The badge behavior is identical on both pages. A single component with a `variant` prop can handle minor styling differences between the landing page (larger, more prominent) and the dashboard (compact).
- **Trade-offs:** None significant. The variant prop keeps the component flexible without duplication.

### Decision 4: Component Location
- **Options considered:** (A) `apps/web/components/android-app-badge.tsx`, (B) `apps/web/app/components/android-app-badge.tsx`, (C) Co-locate near the pages that use it
- **Chosen:** A — `apps/web/components/android-app-badge.tsx`
- **Rationale:** This component is shared across two separate route segments (`/` and `/dashboard`). The `components/` directory at the app root is the natural home for shared UI components. The Tailwind config already includes `./components/**/*.{ts,tsx}` in its content paths, so classes will be picked up automatically.
- **Trade-offs:** Creates the first file in `apps/web/components/` (directory does not yet exist), but this establishes a correct pattern for future shared components.

### Decision 5: Badge Color and Styling
- **Options considered:** (A) Accent orange (matches CTAs), (B) Success green (Android branding), (C) Neutral/secondary style
- **Chosen:** B — Success green (`#059669`)
- **Rationale:** Per the design constraints, green associates with Android branding. It also visually differentiates the badge from the primary CTA buttons (which are accent orange), preventing user confusion between "sign up" and "download app" actions.
- **Trade-offs:** Green is also used for "owed" badges, but the context (download vs balance) eliminates ambiguity.

## 4. Architecture

### 4.1 Data Model Changes

None. This is a frontend-only feature.

### 4.2 API Layer

None. No new API routes required.

### 4.3 Frontend

#### New Component: `AndroidAppBadge`

**File:** `apps/web/components/android-app-badge.tsx`
**Directive:** `'use client'` (manages dialog open/close state)

**Props:**
```ts
type AndroidAppBadgeProps = {
  variant: 'landing' | 'dashboard';
};
```

**Behavior:**
- Renders a clickable badge/button
- On click, opens a Radix `Dialog` containing:
  - Title: "Get the Android App"
  - QR code image (200x200) from `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=<encoded-drive-url>`
  - Instructional text: "Scan this QR code with your phone camera"
  - Direct link fallback: "Or tap here to download directly" (visible on mobile, useful if user is already on phone)
  - Close button (X) in top-right corner

**Variant differences:**
- `landing`: Renders as a pill-shaped badge in the CTA section below the existing buttons, with `animate-fade-up` and appropriate stagger class. Uses `text-sm` sizing.
- `dashboard`: Renders as a compact card-style banner at the top of `<main>`, styled consistently with existing summary cards.

**Styling tokens used:**
- `card` class for the modal content
- `shadow-warm` / `shadow-warm-lg` for elevation
- `bg-success/10` background + `text-success` for the badge icon area
- `font-display` for headings inside the modal
- `animate-scale-in` for modal entrance
- `rounded-2xl` for modal container

#### Landing Page Modification

**File:** `apps/web/app/page.tsx`

Import `AndroidAppBadge` and place it after the CTA buttons div (line 95), inside the hero section. It appears as a subtle green badge below the main CTAs.

```tsx
<AndroidAppBadge variant="landing" />
```

Placement: After the closing `</div>` of the CTAs div (the `mt-10 flex` container), add:
```tsx
<div className="mt-6 opacity-0 animate-fade-up stagger-4">
  <AndroidAppBadge variant="landing" />
</div>
```

#### Dashboard Page Modification

**File:** `apps/web/app/dashboard/page.tsx`

Import `AndroidAppBadge` and place it as the first child inside `<main>`, before the summary cards section.

```tsx
<AndroidAppBadge variant="dashboard" />
```

Placement: As the first element inside the `<main>` tag (before the summary cards section).

### 4.4 Cross-Cutting Concerns

**Error handling:** If the QR code image fails to load, the `<img>` `onError` handler hides the image and shows only the direct download link. No error is thrown or logged since this is a non-critical UI enhancement.

**Accessibility:**
- Radix Dialog provides focus trap, Escape key dismissal, and `aria-labelledby` / `aria-describedby`
- QR code image has descriptive `alt` text
- Direct link provides keyboard-accessible alternative to QR scanning

**Performance:**
- QR code image URL is static and will be browser-cached after first load
- The `<img>` tag uses `loading="lazy"` since the image is inside a dialog that starts closed
- No JavaScript QR generation library added to the bundle

## 5. File Change Manifest

### db-agent
No changes.

### backend-agent
No changes.

### frontend-agent

Files ordered by dependency (create first, then consume):

1. **`apps/web/components/android-app-badge.tsx`** — CREATE
   - New `'use client'` component
   - Imports: `@radix-ui/react-dialog`, `useState`
   - Exports: `AndroidAppBadge` (named export)
   - Contains: badge button, Radix Dialog with QR code, direct link fallback
   - Variant prop controls landing vs dashboard styling

2. **`apps/web/app/page.tsx`** — MODIFY
   - Add import: `import { AndroidAppBadge } from '@/components/android-app-badge';`  (Note: `@/` alias maps to `apps/web/` per Next.js convention)
   - Add `<AndroidAppBadge variant="landing" />` wrapped in a `div` with animation classes, placed after the CTA buttons (after line 95)

3. **`apps/web/app/dashboard/page.tsx`** — MODIFY
   - Add import: `import { AndroidAppBadge } from '@/components/android-app-badge';`
   - Add `<AndroidAppBadge variant="dashboard" />` as the first child inside `<main>` (after line 157, before the summary cards section)

### test-agent

4. **`apps/web/components/android-app-badge.test.tsx`** — CREATE
   - Unit tests for the `AndroidAppBadge` component
   - Test cases: renders badge text, opens dialog on click, dialog contains QR image with correct src, dialog contains direct download link, closes on X button click, both variants render correctly

## 6. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| QR code API (`api.qrserver.com`) becomes unavailable | QR image does not render in the modal | Direct download link is always visible as fallback. `onError` handler on `<img>` gracefully hides the broken image. |
| Google Drive link changes or file is removed | Users cannot download the APK | The Drive URL is a constant in the component; updating it requires a single-line code change. Consider extracting to an env var in the future if it changes frequently. |
| `@/` path alias not configured for `components/` directory | Import fails at build time | Verified: Next.js default `tsconfig.json` maps `@/*` to `./*`, so `@/components/android-app-badge` resolves correctly. Tailwind config already includes `./components/**/*.{ts,tsx}`. |
| Badge competes visually with primary CTAs on landing page | Users confused about primary action | Green color differentiates from orange CTAs. Badge is smaller and placed below CTAs with secondary visual weight. |

## 7. Acceptance Criteria

1. A green "Get Android App" badge is visible on the landing page (`/`) below the hero CTA buttons
2. The same badge (dashboard variant) is visible on the dashboard page (`/dashboard`) above the summary cards
3. Clicking the badge on either page opens a centered modal dialog
4. The modal contains a QR code image that, when scanned, navigates to `https://drive.google.com/file/d/1ypl2yxz8TH1Z5EnunA2JmfJnj48O8Y8v/view?usp=drive_link`
5. The modal contains a direct "Download" link pointing to the same Google Drive URL (opens in new tab)
6. The modal can be dismissed by: (a) clicking the X button, (b) clicking outside the modal, (c) pressing Escape
7. The modal uses the app's `card` styling with `shadow-warm` and `rounded-2xl`
8. The badge uses `bg-success/10` and `text-success` colors consistent with Android green branding
9. The component uses `@radix-ui/react-dialog` for the modal (no custom modal implementation)
10. The component file is a client component (`'use client'` directive)
11. No new npm dependencies are added
12. The badge and modal are responsive and usable on mobile screen sizes (320px width minimum)
13. The QR code `<img>` has a meaningful `alt` attribute for accessibility
14. If the QR image fails to load, the modal still shows the direct download link without a broken image
