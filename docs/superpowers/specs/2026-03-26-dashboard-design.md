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
- User avatar (`user.user_metadata.avatar_url`) + display name (`user.user_metadata.full_name`) pinned to the bottom of the sidebar

Active link is highlighted with a white semi-transparent pill background. Inactive links are white at 70% opacity.

### Mobile (< 768px)

Sidebar is hidden. A fixed purple tab bar appears at the bottom of the screen with three tabs:

- 🏠 Home (Dashboard)
- 🎮 Play
- ⚙️ Settings

Active tab is full white; inactive tabs are white at 55% opacity. The tab bar is `position: fixed; bottom: 0` — it overlaps content. The content area has `pb-16` so nothing is hidden behind the tab bar.

### Extensibility

The nav items are defined in a single array in `AppNav.tsx`. Adding a new page requires only adding one entry to that array — no structural changes needed.

---

## Routing Changes

| Route | Before | After |
|---|---|---|
| `/` | Redirect to `/play` | Redirect to `/dashboard` |
| `/dashboard` | Does not exist | New dashboard page |
| `/play` | Lives in `(game)` group | Moved to `(app)` group, unchanged |
| `/no-set` | Lives in `(game)` group | Moved to `(app)` group, unchanged |
| `/access-denied` | Lives in `(game)` group | Stays public — move to `(auth)` group (no nav shell) |
| `/settings` | Does not exist | New settings/profile page in `(app)` group |

The existing `(game)` route group is replaced by a new `(app)` route group. `/dashboard`, `/play`, `/no-set`, and `/settings` all live inside `(app)` and share the nav shell layout.

`/access-denied` is a public page (listed as a public path in `proxy.ts`). It moves to the `(auth)` route group alongside `/login`, with no nav shell.

The admin routes (`/admin/*`) keep their own separate layout and are unaffected.

### Auth Guard in `(app)/layout.tsx`

The `(app)/layout.tsx` server component is responsible for:
1. Calling `supabase.auth.getUser()` to get the current user
2. Redirecting to `/login` if unauthenticated
3. Passing `user.user_metadata.full_name` and `user.user_metadata.avatar_url` to the sidebar/bottom bar components

It does **not** re-check `is_approved` — that is already enforced by `proxy.ts` before the request reaches the layout. The layout can trust that any user who reaches it is authenticated and approved.

The existing `UserMenu` component (currently in the `(game)` layout header) is removed. Its sign-out functionality moves to the Settings page.

---

## Dashboard Page (`/dashboard`)

### Score Data Query

Fetched server-side using the service client. Because the Supabase JS query builder does not support `COUNT ... FILTER`, use a raw SQL query via `supabase.rpc()` or `supabase.from(...).select()` with a computed column. The recommended approach is a raw SQL query using `rpc`:

```sql
-- Supabase RPC function: get_user_recent_scores(p_user_id uuid, p_limit int)
SELECT
  ds.set_date,
  ROUND(
    COUNT(*) FILTER (WHERE up.result = 'got_it') * 100.0 / COUNT(*)
  )::int AS score_pct
FROM user_progress up
JOIN daily_sets ds ON ds.id = up.set_id
WHERE up.user_id = p_user_id
GROUP BY ds.set_date, up.set_id
ORDER BY ds.set_date DESC
LIMIT p_limit;
```

This RPC function must be created in Supabase (SQL Editor) as a migration step. It returns rows of `{ set_date: string, score_pct: number }`, newest first.

The dashboard fetches with `limit = 7`. The result is reversed before rendering so the oldest session appears on the left (chronological order).

If the user has never played, the query returns an empty array — show the empty state.

### Dashboard Layout

**Desktop:**
```
┌──────────────────────────────────────────────────────┐
│ Good morning, [Name] 👋         [▶ Play Today's Set] │
├──────────────────────────────────────────────────────┤
│  Last 7 Games                                        │
│                                                      │
│  95%  75%  55%  25%  78%  92%  60%                  │
│  ████  ███  ██   █   ███  ████  ██                   │
│  Mon  Tue  Wed  Thu  Fri  Sat  Sun                   │
├──────────────┬───────────────┬───────────────────────┤
│ Recent avg   │ Best score    │ ╌ Coming soon ╌       │
│ 69%          │ 95%           │                       │
└──────────────┴───────────────┴───────────────────────┘
```

**Mobile:** greeting and "Play Today's Set" button stack vertically (greeting on top, full-width button below). Chart and stat cards below, full width.

### Score Bar Colors

| Score | Color | Tailwind class |
|---|---|---|
| 90–100% | Solid green | `bg-green-600` |
| 70–89% | Light green | `bg-green-300` |
| 40–69% | Yellow | `bg-amber-400` |
| 0–39% | Red | `bg-red-500` |

Bar height: max bar height is `120px`. Each bar's height = `Math.round(score_pct / 100 * 120)px`. Score percentage shown above each bar. Day label (`Mon`/`Tue`/… on desktop, `M`/`T`/… on mobile) derived from `set_date` using `toLocaleDateString('en-US', { weekday: 'short' })` — shown below the bar. No legend.

### Stat Cards (bottom row)

- **Recent avg** — average of the scores returned (not "7-day avg" since the user may have fewer than 7 sessions). Value in purple.
- **Best score** — max of the scores returned. Value in green.
- **Placeholder** — dashed border, greyed out, "Coming soon" text. For future features.

### "Play Today's Set" Button

Always shown. Links to `/play`. The dashboard does **not** query `daily_sets` to check if today's set exists — `/play` handles that and redirects to `/no-set` if needed.

### Empty State

If the user has 0 sessions: replace the chart area with a centered message:
> *"Play your first set to see your scores here."*

Stat cards are hidden when there is no data.

---

## Settings Page (`/settings`)

Data comes from `supabase.auth.getUser()` — the `user` object returned by the Supabase auth client. All fields are read-only in v1.

| Field | Source |
|---|---|
| Avatar photo | `user.user_metadata.avatar_url` (Google profile photo URL) |
| Display name | `user.user_metadata.full_name` |
| Email | `user.email` |

**Sign out:** Call `supabase.auth.signOut()` (client-side), then redirect to `/login`. This replaces the sign-out behaviour previously in `UserMenu`.

No editable fields in v1. Space reserved for future preferences.

---

## Component Structure

```
app/
  (app)/
    layout.tsx          — Nav shell: fetches user, renders AppSidebar + AppBottomBar
    dashboard/
      page.tsx          — Server component; calls RPC, passes data to ScoreChart
    play/
      page.tsx          — Existing game (moved from (game) group, no changes)
    no-set/
      page.tsx          — Existing no-set page (moved, no changes)
    settings/
      page.tsx          — Client component; calls supabase.auth.getUser()
  (auth)/
    login/page.tsx      — Unchanged
    access-denied/
      page.tsx          — Moved from (game), no nav shell
  admin/
    layout.tsx          — Unchanged
  page.tsx              — Redirect: / → /dashboard

components/
  app/
    AppNav.tsx          — NAV_ITEMS array + scoreColor helper re-export; shared by sidebar + bottom bar
    AppSidebar.tsx      — Desktop sidebar; renders AppNav items + user avatar/name
    AppBottomBar.tsx    — Mobile bottom tab bar; renders AppNav items
  dashboard/
    ScoreChart.tsx      — Pure component; receives ScoreEntry[] props; renders bars
    StatCard.tsx        — Single stat card (label, value, color variant)

lib/
  score-color.ts        — Pure helper: scoreColor(pct: number): string
```

---

## Score Color Helper

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

## Database: New RPC Function

A new Supabase migration creates the RPC function:

```sql
-- supabase/migrations/004_get_user_recent_scores.sql
CREATE OR REPLACE FUNCTION get_user_recent_scores(p_user_id uuid, p_limit int)
RETURNS TABLE(set_date date, score_pct int)
LANGUAGE sql
STABLE
AS $$
  SELECT
    ds.set_date,
    ROUND(
      COUNT(*) FILTER (WHERE up.result = 'got_it') * 100.0 / COUNT(*)
    )::int AS score_pct
  FROM user_progress up
  JOIN daily_sets ds ON ds.id = up.set_id
  WHERE up.user_id = p_user_id
  GROUP BY ds.set_date, up.set_id
  ORDER BY ds.set_date DESC
  LIMIT p_limit;
$$;
```

This function must be run in Supabase SQL Editor before the dashboard page will work.

---

## Responsive Behaviour

| Breakpoint | Sidebar | Bottom bar | Chart labels | Button |
|---|---|---|---|---|
| ≥ 768px (md) | Visible, 110px wide | Hidden | Mon/Tue/… | Top-right |
| < 768px | Hidden | Fixed bottom, full width | M/T/… | Full-width below greeting |

Content area: `md:ml-[110px]` on desktop to offset sidebar. `pb-16` on mobile to clear the bottom tab bar.

---

## Error & Empty States

| Situation | Behaviour |
|---|---|
| User has 0 games played | Chart replaced by empty state message; stat cards hidden |
| User has 1–6 games played | Only bars for actual sessions shown |
| No daily set published today | Button shown; `/play` redirects to `/no-set` |
| RPC fetch fails | Chart area shows error message; rest of page renders |
| `avatar_url` is null | Show a default avatar (user's initials in a coloured circle) |

---

## What Is Not In Scope

- Leaderboard or comparison with other users
- Scores beyond the last 7 sessions
- Push notifications or streak tracking
- Editing display name or profile photo
- Dark mode
