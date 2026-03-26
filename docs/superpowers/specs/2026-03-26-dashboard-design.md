# Dashboard & Navigation Shell — Design Spec

## Overview

Add a persistent navigation shell and a user dashboard as the new landing page for all logged-in users. The dashboard shows the user's last 7 game scores as a color-coded bar chart, summary stat cards, a "Play Today's Set" CTA, and a placeholder area for future features. Navigation is always accessible via a purple sidebar on desktop and a bottom tab bar on mobile.

---

## Goals

- Give users a meaningful home page instead of dropping them straight into the game
- Show recent performance at a glance without requiring any interaction
- Establish a scalable navigation structure that can accommodate future pages (leaderboards, new games, etc.)
- Work well on both desktop browsers and mobile phone browsers

---

## Navigation Shell

### Desktop (≥ 768px)

A fixed purple sidebar on the left, always visible. Contains:

- App logo / name at the top: **🃏 FlashCards**
- Nav links (icon + label):
  - 🏠 Dashboard (active state: white semi-transparent background)
  - 🎮 Play Game
  - ⚙️ Settings
- User avatar + display name pinned to the bottom of the sidebar

Active link is highlighted with a white semi-transparent pill background. Inactive links are white at 70% opacity.

### Mobile (< 768px)

Sidebar is hidden. A fixed purple tab bar appears at the bottom of the screen with three tabs:

- 🏠 Home (Dashboard)
- 🎮 Play
- ⚙️ Settings

Active tab is full white; inactive tabs are white at 55% opacity. The tab bar never scrolls away.

### Extensibility

The nav items are defined in a single array in the layout component so adding a new page (e.g. a second game, a leaderboard) requires only adding one entry to that array — no structural changes needed.

---

## Routing Changes

| Route | Before | After |
|---|---|---|
| `/` | Redirect to `/play` | Redirect to `/dashboard` |
| `/dashboard` | Does not exist | New dashboard page |
| `/play` | Main game page | Same — unchanged |
| `/settings` | Does not exist | New settings/profile page |
| `/(game)/layout.tsx` | Header with user menu only | Replaced by new nav shell layout |

The existing `(game)` route group layout is replaced by a new `(app)` route group that wraps `/dashboard`, `/play`, and `/settings` with the shared nav shell. The `UserMenu` component in the old header is removed — the user identity moves to the sidebar bottom.

The admin routes (`/admin/*`) keep their own separate layout and are unaffected.

---

## Dashboard Page (`/dashboard`)

### Data

Fetched server-side using the service client:

1. **Last 7 sessions** — query `user_progress` joined to `daily_sets`, grouped by `set_id`, ordered by `daily_sets.set_date DESC`, limit 7 sessions where the user has at least one progress row.
2. **Per-session score** — for each session: `COUNT(*) FILTER (WHERE result = 'got_it') / COUNT(*) * 100`, rounded to nearest integer.
3. **7-day average** — mean of the 7 session scores (or fewer if user has played fewer than 7 games).
4. **Best score** — max of the 7 session scores.

If the user has never played, the chart area shows a friendly empty state: *"Play your first set to see your scores here."*

### Layout

```
┌─────────────────────────────────────────────┐
│ Good morning, [Name] 👋    [▶ Play Today's Set] │
├─────────────────────────────────────────────┤
│                                             │
│  Last 7 Games                               │
│                                             │
│  95%  75%  55%  25%  78%  92%  60%         │
│  ██   ▓▓   ▒▒   ░░   ▓▓   ██   ▒▒          │
│  Mon  Tue  Wed  Thu  Fri  Sat  Sun          │
│                                             │
├──────────────┬──────────────┬───────────────┤
│ 7-day avg    │ Best score   │ (dashed box)  │
│ 69%          │ 95%          │ Coming soon   │
└──────────────┴──────────────┴───────────────┘
```

### Score Bar Colors

| Score | Color | Tailwind |
|---|---|---|
| 90–100% | Solid green | `bg-green-600` (#16a34a) |
| 70–89% | Light green | `bg-green-300` (#86efac) |
| 40–69% | Yellow | `bg-amber-400` (#fbbf24) |
| 0–39% | Red | `bg-red-500` (#ef4444) |

Bar height is proportional to score (score% of max bar height). Score percentage shown above each bar. Day label (Mon/Tue/… or M/T/… on mobile) shown below.

No legend is shown — the colors are intuitive enough on their own.

### Stat Cards (bottom row)

- **7-day avg** — purple value
- **Best score** — green value
- **Placeholder** — dashed border, greyed out, "Coming soon" text. Reserved for a future feature (e.g. streak, total words learned).

### "Play Today's Set" Button

- Top-right on desktop, below the greeting on mobile
- Links to `/play`
- If no set has been published today (admin hasn't published), button still shows but `/play` will display the existing "No new cards today" screen

---

## Settings Page (`/settings`)

A simple profile page. For v1, shows:

- User avatar (from Google OAuth profile photo)
- Display name (from Google account)
- Email address (read-only)
- Sign out button

No editable fields in v1. Space is reserved for future preferences (notification settings, language options, etc.).

---

## Component Structure

```
app/
  (app)/
    layout.tsx          — Nav shell: sidebar (desktop) + bottom tab bar (mobile)
    dashboard/
      page.tsx          — Dashboard (server component, fetches score data)
    play/
      page.tsx          — Existing game (moved from (game) group)
    settings/
      page.tsx          — Profile/settings page
  (auth)/
    login/page.tsx      — Unchanged
  admin/
    layout.tsx          — Unchanged (separate nav)
  page.tsx              — Redirect: / → /dashboard

components/
  app/
    AppNav.tsx          — Nav items array + active link logic (shared by sidebar + bottom bar)
    AppSidebar.tsx      — Desktop sidebar (uses AppNav)
    AppBottomBar.tsx    — Mobile bottom tab bar (uses AppNav)
  dashboard/
    ScoreChart.tsx      — Bar chart component (pure, receives score data as props)
    StatCard.tsx        — Individual stat card (label + value + optional color)
```

---

## Score Color Logic

Centralised in a pure helper function (no component coupling):

```typescript
// lib/score-color.ts
export function scoreColor(pct: number): string {
  if (pct >= 90) return 'bg-green-600'
  if (pct >= 70) return 'bg-green-300'
  if (pct >= 40) return 'bg-amber-400'
  return 'bg-red-500'
}
```

---

## Responsive Behaviour

| Breakpoint | Sidebar | Bottom bar | Chart day labels |
|---|---|---|---|
| ≥ 768px (md) | Visible (110px wide) | Hidden | Full name (Mon, Tue…) |
| < 768px | Hidden | Visible (fixed bottom) | Single letter (M, T…) |

The main content area fills 100% width minus the sidebar on desktop, and 100% width on mobile (bottom bar does not reduce content height — it overlaps, so content has `pb-16` padding to avoid being hidden behind it).

---

## Error & Empty States

| Situation | Behaviour |
|---|---|
| User has 0 games played | Chart area shows empty state message |
| User has 1–6 games played | Chart shows only the bars that exist (no placeholder bars) |
| No daily set published today | "Play Today's Set" button still shown; clicking goes to `/play` which shows the existing no-set screen |
| Score data fetch fails | Dashboard shows error message; other parts of page still render |

---

## What Is Not In Scope

- Leaderboard or comparison with other users
- Scores beyond the last 7 sessions
- Push notifications or streak tracking
- Editing display name or profile photo
- Dark mode
