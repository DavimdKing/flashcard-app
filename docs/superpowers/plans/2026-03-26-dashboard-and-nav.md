# Dashboard & Navigation Shell — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bare game layout with a persistent purple sidebar (desktop) / bottom tab bar (mobile) navigation shell, and add a `/dashboard` landing page showing the user's last 7 game scores as a color-coded bar chart with stat cards.

**Architecture:** A new `(app)` Next.js route group replaces the existing `(game)` group. Its shared layout renders the nav shell (sidebar + bottom bar). The dashboard fetches score history via a Supabase RPC function that runs aggregated SQL. A new `(auth)` sub-page hosts `/access-denied` without the nav shell. All nav items are defined in one array in `AppNav.tsx` — adding a future page means adding one entry.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase PostgreSQL (RPC), Tailwind CSS, `@supabase/ssr`, `@supabase/supabase-js`

> **Note:** Before writing any Next.js code, check `node_modules/next/dist/docs/` for API details — Next.js 16 has breaking changes vs earlier versions. No automated test runner exists; verification uses `npx tsc --noEmit` and manual browser testing.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/004_get_user_recent_scores.sql` | Create | RPC function for score aggregation |
| `lib/score-color.ts` | Create | Pure helper: score % → Tailwind color class |
| `components/app/AppNav.tsx` | Create | NAV_ITEMS array + active-link detection |
| `components/app/AppSidebar.tsx` | Create | Desktop sidebar — renders AppNav items + user avatar |
| `components/app/AppBottomBar.tsx` | Create | Mobile bottom tab bar — renders AppNav items |
| `app/(app)/layout.tsx` | Create | Nav shell server component — fetches user, composes sidebar + bottom bar |
| `app/(app)/dashboard/page.tsx` | Create | Dashboard server component — calls RPC, renders chart + stat cards |
| `app/(app)/play/page.tsx` | Create (move) | Existing game page moved from `(game)` group, content unchanged |
| `app/(app)/no-set/page.tsx` | Create (move) | Existing no-set page moved from `(game)` group, content unchanged |
| `app/(app)/settings/page.tsx` | Create | Settings/profile client component — shows avatar, name, email, sign out |
| `app/(auth)/access-denied/page.tsx` | Create (move) | Existing access-denied page moved from `(game)` group, content unchanged |
| `app/(game)/layout.tsx` | Delete | Replaced by `(app)/layout.tsx` |
| `app/(game)/play/page.tsx` | Delete | Moved to `(app)` |
| `app/(game)/no-set/page.tsx` | Delete | Moved to `(app)` |
| `app/(game)/access-denied/page.tsx` | Delete | Moved to `(auth)` |
| `app/page.tsx` | Modify | Change redirect from `/play` → `/dashboard` |
| `proxy.ts` | Modify | Change admin-redirect from `/play` → `/dashboard` |
| `components/dashboard/ScoreChart.tsx` | Create | Pure component: renders color-coded bar chart from score data |
| `components/dashboard/StatCard.tsx` | Create | Single stat card (label + value + optional color) |

---

## Task 1: Database Migration — Score RPC Function

**Files:**
- Create: `supabase/migrations/004_get_user_recent_scores.sql`

- [ ] **Step 1: Create the migration file**

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

- [ ] **Step 2: Run migration in Supabase**

Go to Supabase Dashboard → SQL Editor → paste the SQL above → Run.

Verify: In SQL Editor run `SELECT get_user_recent_scores('00000000-0000-0000-0000-000000000000'::uuid, 7);` — should return an empty result set with no error (function exists).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/004_get_user_recent_scores.sql
git commit -m "feat: add get_user_recent_scores RPC function"
```

---

## Task 2: Score Color Helper

**Files:**
- Create: `lib/score-color.ts`

- [ ] **Step 1: Create the helper**

```typescript
// lib/score-color.ts
export function scoreColor(pct: number): string {
  if (pct >= 90) return 'bg-green-600'
  if (pct >= 70) return 'bg-green-300'
  if (pct >= 40) return 'bg-amber-400'
  return 'bg-red-500'
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd flashcard-app && npx tsc --noEmit
```
Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
git add lib/score-color.ts
git commit -m "feat: add scoreColor helper"
```

---

## Task 3: AppNav Component

**Files:**
- Create: `components/app/AppNav.tsx`

This component owns the canonical nav items array and active-link detection. Both `AppSidebar` and `AppBottomBar` import from here so the nav is defined in exactly one place.

- [ ] **Step 1: Create the component**

```typescript
// components/app/AppNav.tsx
export interface NavItem {
  label: string
  href: string
  icon: string
  mobileLabel: string
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: '🏠', mobileLabel: 'Home' },
  { label: 'Play Game',  href: '/play',      icon: '🎮', mobileLabel: 'Play' },
  { label: 'Settings',  href: '/settings',  icon: '⚙️', mobileLabel: 'Settings' },
]

export function isActive(href: string, pathname: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname === href || pathname.startsWith(href + '/')
}
```

- [ ] **Step 2: TypeScript check + commit**

```bash
npx tsc --noEmit
git add components/app/AppNav.tsx
git commit -m "feat: add AppNav items array and isActive helper"
```

---

## Task 4: AppSidebar Component

**Files:**
- Create: `components/app/AppSidebar.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/app/AppSidebar.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV_ITEMS, isActive } from './AppNav'

interface Props {
  displayName: string
  avatarUrl: string | null
}

export default function AppSidebar({ displayName, avatarUrl }: Props) {
  const pathname = usePathname()
  const initial = displayName?.[0]?.toUpperCase() ?? '?'

  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-full w-[110px] bg-purple-600 flex-col gap-1 px-2 py-4 z-40">
      {/* Logo */}
      <div className="text-white font-bold text-sm px-2 mb-4">🃏 FlashCards</div>

      {/* Nav links */}
      {NAV_ITEMS.map(item => (
        <Link
          key={item.href}
          href={item.href}
          className={`flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-xs font-medium transition ${
            isActive(item.href, pathname)
              ? 'bg-white/25 text-white'
              : 'text-white/70 hover:bg-white/10 hover:text-white'
          }`}
        >
          <span className="text-xl">{item.icon}</span>
          <span>{item.label}</span>
        </Link>
      ))}

      {/* User avatar pinned to bottom */}
      <div className="mt-auto border-t border-white/20 pt-3 px-1">
        <div className="flex items-center gap-2">
          {avatarUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={avatarUrl} alt={displayName} className="w-7 h-7 rounded-full object-cover" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-white/30 flex items-center justify-center text-white text-xs font-bold">
              {initial}
            </div>
          )}
          <span className="text-white/80 text-xs truncate">{displayName}</span>
        </div>
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: TypeScript check + commit**

```bash
npx tsc --noEmit
git add components/app/AppSidebar.tsx
git commit -m "feat: add AppSidebar desktop navigation component"
```

---

## Task 5: AppBottomBar Component

**Files:**
- Create: `components/app/AppBottomBar.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/app/AppBottomBar.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV_ITEMS, isActive } from './AppNav'

export default function AppBottomBar() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-purple-600 flex justify-around py-2 z-40">
      {NAV_ITEMS.map(item => {
        const active = isActive(item.href, pathname)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center gap-0.5 px-4 ${
              active ? 'text-white' : 'text-white/55'
            }`}
          >
            <span className="text-xl">{item.icon}</span>
            <span className="text-[10px] font-medium">{item.mobileLabel}</span>
          </Link>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 2: TypeScript check + commit**

```bash
npx tsc --noEmit
git add components/app/AppBottomBar.tsx
git commit -m "feat: add AppBottomBar mobile navigation component"
```

---

## Task 6: App Layout (Nav Shell)

**Files:**
- Create: `app/(app)/layout.tsx`

This server component fetches the authenticated user and renders both the sidebar and bottom bar.

- [ ] **Step 1: Create the layout**

```tsx
// app/(app)/layout.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppSidebar from '@/components/app/AppSidebar'
import AppBottomBar from '@/components/app/AppBottomBar'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const displayName: string = user.user_metadata?.full_name ?? user.email ?? 'User'
  const avatarUrl: string | null = user.user_metadata?.avatar_url ?? null

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-purple-50">
      <AppSidebar displayName={displayName} avatarUrl={avatarUrl} />
      {/* Offset content by sidebar width on desktop; add bottom padding on mobile for tab bar */}
      <div className="md:ml-[110px] pb-16 md:pb-0">
        {children}
      </div>
      <AppBottomBar />
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check + commit**

```bash
npx tsc --noEmit
git add app/(app)/layout.tsx
git commit -m "feat: add (app) layout with sidebar and bottom nav shell"
```

---

## Task 7: Move play and no-set Pages into (app) Group

**Files:**
- Create: `app/(app)/play/page.tsx` (copy of existing `(game)/play/page.tsx`)
- Create: `app/(app)/no-set/page.tsx` (copy of existing `(game)/no-set/page.tsx`)
- Delete: `app/(game)/play/page.tsx`
- Delete: `app/(game)/no-set/page.tsx`

- [ ] **Step 1: Copy play/page.tsx**

Create `app/(app)/play/page.tsx` with the exact same content as `app/(game)/play/page.tsx`. No changes to the content.

Read the file first, then create an identical copy at the new path.

- [ ] **Step 2: Copy no-set/page.tsx**

Create `app/(app)/no-set/page.tsx` with the exact same content as `app/(game)/no-set/page.tsx`. No changes to the content.

- [ ] **Step 3: Delete old files**

```bash
rm "app/(game)/play/page.tsx"
rm "app/(game)/no-set/page.tsx"
```

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: No errors. The routes still resolve at `/play` and `/no-set` via the new `(app)` group.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: move play and no-set pages into (app) route group"
```

---

## Task 8: Move access-denied to (auth) Group + Delete (game) Layout

**Files:**
- Create: `app/(auth)/access-denied/page.tsx` (copy of existing `(game)/access-denied/page.tsx`)
- Delete: `app/(game)/access-denied/page.tsx`
- Delete: `app/(game)/layout.tsx`

- [ ] **Step 1: Copy access-denied/page.tsx**

Create `app/(auth)/access-denied/page.tsx` with the exact same content as `app/(game)/access-denied/page.tsx`. No changes to the content.

Note: The `(auth)` route group may already have a `login/` subdirectory. Adding `access-denied/` alongside it is correct — no shared layout file is needed in `(auth)` since both pages render their own full-screen layout.

- [ ] **Step 2: Delete old files**

```bash
rm "app/(game)/access-denied/page.tsx"
rm "app/(game)/layout.tsx"
```

Check that `app/(game)/` directory is now empty and remove it:

```bash
rmdir "app/(game)" 2>/dev/null || true
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: move access-denied to (auth) group, remove (game) layout"
```

---

## Task 9: Update Root Redirect and Proxy

**Files:**
- Modify: `app/page.tsx`
- Modify: `proxy.ts`

- [ ] **Step 1: Update root redirect**

In `app/page.tsx`, change:
```typescript
redirect('/play')
```
To:
```typescript
redirect('/dashboard')
```

- [ ] **Step 2: Update admin redirect in proxy**

In `proxy.ts`, find:
```typescript
if (isAdminRoute(pathname) && !appUser?.is_admin) {
  return NextResponse.redirect(new URL('/play', request.url))
}
```
Change to:
```typescript
if (isAdminRoute(pathname) && !appUser?.is_admin) {
  return NextResponse.redirect(new URL('/dashboard', request.url))
}
```

- [ ] **Step 3: TypeScript check + commit**

```bash
npx tsc --noEmit
git add app/page.tsx proxy.ts
git commit -m "feat: redirect root and non-admin users to /dashboard"
```

---

## Task 10: StatCard Component

**Files:**
- Create: `components/dashboard/StatCard.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/dashboard/StatCard.tsx
interface Props {
  label: string
  value: string
  valueColor?: string
  placeholder?: boolean
}

export default function StatCard({ label, value, valueColor = 'text-purple-600', placeholder = false }: Props) {
  if (placeholder) {
    return (
      <div className="flex-1 bg-white rounded-2xl p-4 border border-dashed border-gray-200 opacity-60">
        <p className="text-xs text-gray-400 mb-1">Coming soon</p>
        <p className="text-sm text-gray-300">New feature</p>
      </div>
    )
  }

  return (
    <div className="flex-1 bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${valueColor}`}>{value}</p>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check + commit**

```bash
npx tsc --noEmit
git add components/dashboard/StatCard.tsx
git commit -m "feat: add StatCard component"
```

---

## Task 11: ScoreChart Component

**Files:**
- Create: `components/dashboard/ScoreChart.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/dashboard/ScoreChart.tsx
import { scoreColor } from '@/lib/score-color'

export interface ScoreEntry {
  set_date: string   // ISO date string, e.g. "2026-03-25"
  score_pct: number  // 0–100
}

const MAX_BAR_HEIGHT = 120 // px

function dayLabel(dateStr: string, short: boolean): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: short ? 'narrow' : 'short' })
}

interface Props {
  scores: ScoreEntry[]
}

export default function ScoreChart({ scores }: Props) {
  if (scores.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-400 text-sm text-center px-4">
        Play your first set to see your scores here.
      </div>
    )
  }

  // Scores arrive newest-first from DB; reverse to show oldest on left
  const ordered = [...scores].reverse()

  return (
    <div className="flex gap-2 items-end justify-around" style={{ height: `${MAX_BAR_HEIGHT + 40}px` }}>
      {ordered.map((entry) => {
        const barHeight = Math.max(4, Math.round(entry.score_pct / 100 * MAX_BAR_HEIGHT))
        const color = scoreColor(entry.score_pct)
        return (
          <div key={entry.set_date} className="flex flex-col items-center gap-1 flex-1">
            {/* Score label */}
            <span className="text-xs font-semibold text-gray-700">{entry.score_pct}%</span>
            {/* Bar */}
            <div
              className={`w-full rounded-t-md ${color}`}
              style={{ height: `${barHeight}px` }}
            />
            {/* Day label — short on mobile, long on desktop */}
            <span className="text-[10px] text-gray-400 md:hidden">{dayLabel(entry.set_date, true)}</span>
            <span className="text-xs text-gray-400 hidden md:block">{dayLabel(entry.set_date, false)}</span>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check + commit**

```bash
npx tsc --noEmit
git add components/dashboard/ScoreChart.tsx
git commit -m "feat: add ScoreChart component with color-coded bars"
```

---

## Task 12: Dashboard Page

**Files:**
- Create: `app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
// app/(app)/dashboard/page.tsx
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import ScoreChart, { type ScoreEntry } from '@/components/dashboard/ScoreChart'
import StatCard from '@/components/dashboard/StatCard'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const displayName: string = user.user_metadata?.full_name ?? user.email ?? 'there'
  const firstName = displayName.split(' ')[0]

  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? 'Good morning' :
    hour < 18 ? 'Good afternoon' :
    'Good evening'

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  const service = createServiceClient()
  const { data: rawScores } = await service.rpc('get_user_recent_scores', {
    p_user_id: user.id,
    p_limit: 7,
  })

  const scores: ScoreEntry[] = (rawScores ?? []) as ScoreEntry[]

  const recentAvg = scores.length > 0
    ? Math.round(scores.reduce((sum, s) => sum + s.score_pct, 0) / scores.length)
    : null

  const bestScore = scores.length > 0
    ? Math.max(...scores.map(s => s.score_pct))
    : null

  return (
    <main className="p-4 md:p-8 max-w-2xl">
      {/* Greeting row */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{greeting}, {firstName} 👋</h1>
          <p className="text-sm text-gray-500 mt-0.5">{today}</p>
        </div>
        <Link
          href="/play"
          className="w-full md:w-auto bg-purple-600 hover:bg-purple-700 text-white font-semibold px-5 py-2.5 rounded-xl text-sm text-center transition"
        >
          ▶ Play Today&apos;s Set
        </Link>
      </div>

      {/* Score chart */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Last 7 Games</h2>
        <ScoreChart scores={scores} />
      </div>

      {/* Stat cards */}
      {scores.length > 0 && (
        <div className="flex gap-3">
          <StatCard
            label="Recent avg"
            value={`${recentAvg}%`}
            valueColor="text-purple-600"
          />
          <StatCard
            label="Best score"
            value={`${bestScore}%`}
            valueColor="text-green-600"
          />
          <StatCard placeholder />
        </div>
      )}
    </main>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 3: Manual verify**

Visit `/dashboard` in the browser. Confirm:
- Greeting and today's date show correctly
- "Play Today's Set" button is top-right on desktop, full-width below greeting on mobile
- Chart renders (even if empty — shows the placeholder message)
- Stat cards show if there are scores

- [ ] **Step 4: Commit**

```bash
git add app/(app)/dashboard/page.tsx
git commit -m "feat: add dashboard page with score chart and stat cards"
```

---

## Task 13: Settings Page

**Files:**
- Create: `app/(app)/settings/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
// app/(app)/settings/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface UserInfo {
  displayName: string
  email: string
  avatarUrl: string | null
}

export default function SettingsPage() {
  const router = useRouter()
  const [user, setUser] = useState<UserInfo | null>(null)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setUser({
        displayName: user.user_metadata?.full_name ?? user.email ?? 'User',
        email: user.email ?? '',
        avatarUrl: user.user_metadata?.avatar_url ?? null,
      })
    })
  }, [])

  const handleSignOut = async () => {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/login')
  }

  const initial = user?.displayName?.[0]?.toUpperCase() ?? '?'

  return (
    <main className="p-4 md:p-8 max-w-md">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Settings</h1>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        {/* Avatar + name */}
        <div className="flex items-center gap-4 mb-6">
          {user?.avatarUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={user.avatarUrl}
              alt={user.displayName}
              className="w-16 h-16 rounded-full object-cover"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-purple-200 flex items-center justify-center text-purple-700 text-2xl font-bold">
              {initial}
            </div>
          )}
          <div>
            <p className="font-semibold text-gray-800 text-lg">{user?.displayName ?? '—'}</p>
            <p className="text-sm text-gray-500">{user?.email ?? '—'}</p>
          </div>
        </div>

        {/* Info rows */}
        <div className="space-y-3 mb-6">
          <div className="flex justify-between text-sm py-2 border-b border-gray-50">
            <span className="text-gray-500">Display name</span>
            <span className="text-gray-800 font-medium">{user?.displayName ?? '—'}</span>
          </div>
          <div className="flex justify-between text-sm py-2 border-b border-gray-50">
            <span className="text-gray-500">Email</span>
            <span className="text-gray-800 font-medium">{user?.email ?? '—'}</span>
          </div>
          <div className="flex justify-between text-sm py-2">
            <span className="text-gray-500">Login method</span>
            <span className="text-gray-800 font-medium">Google</span>
          </div>
        </div>

        {/* Sign out */}
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full py-2.5 rounded-xl border border-red-200 text-red-500 text-sm font-semibold hover:bg-red-50 transition disabled:opacity-50"
        >
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Manual verify**

Visit `/settings`. Confirm:
- Avatar (or initial circle) shows
- Display name and email are correct
- Sign out button works — redirects to `/login`

- [ ] **Step 4: Commit**

```bash
git add app/(app)/settings/page.tsx
git commit -m "feat: add settings page with user profile and sign-out"
```

---

## Task 14: Deploy

- [ ] **Step 1: Final TypeScript check**

```bash
npx tsc --noEmit
```
Expected: Zero errors.

- [ ] **Step 2: End-to-end manual verify**

Check all routes work:
1. `/` → redirects to `/dashboard`
2. `/dashboard` → shows greeting, chart (or empty state), stat cards, "Play Today's Set" button
3. `/play` → game works as before
4. `/no-set` → no-set message displays with nav shell visible
5. `/settings` → profile shows, sign out works
6. `/access-denied` → shows without nav shell (direct URL visit)
7. Sidebar visible on desktop, bottom bar on mobile
8. Non-admin clicking `/admin` → redirects to `/dashboard`

- [ ] **Step 3: Push to deploy**

```bash
git push
```

Watch Vercel build log — confirm no TypeScript or build errors.
