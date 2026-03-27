# Practice Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Practice module where users play flashcard sessions against admin-curated vocabulary groups of 20 words, with best scores tracked and shown on the Dashboard.

**Architecture:** Three new DB tables (`practice_groups`, `practice_group_words`, `practice_sessions`) hold groups and results. The existing `CardStack` is extended with `mode="practice"` and an `onSessionComplete` callback so no progress API calls are made. A thin client wrapper (`PracticePlay`) owns the callback and navigates to the score screen. The Dashboard gains a `PracticeBestScores` client component that fetches via a new API route.

**Tech Stack:** Next.js 16 App Router (server + client components), Supabase (postgres + RLS + RPC), Tailwind CSS, Jest + React Testing Library (existing test setup, run with `npm test`)

---

## File Map

### New files
| File | Role |
|---|---|
| `supabase/migrations/005_practice_module.sql` | DB tables, RLS, RPCs — run manually in Supabase |
| `app/api/practice/sessions/route.ts` | POST — save a completed practice session |
| `app/api/practice/sessions/route.test.ts` | Tests for sessions API |
| `app/api/practice/groups/route.ts` | GET — active groups + user best scores (for dashboard) |
| `app/api/practice/groups/route.test.ts` | Tests for groups API |
| `app/api/admin/practice-groups/words/route.ts` | GET — word search for WordPicker |
| `app/api/admin/practice-groups/[id]/route.ts` | PUT + DELETE — edit/delete a practice group |
| `app/api/admin/practice-groups/route.ts` | POST — create a new practice group |
| `components/practice/PracticeGroupGrid.tsx` | Client — grid view of groups |
| `components/practice/PracticeGroupList.tsx` | Client — list view with progress bars |
| `components/practice/PracticeGroupGrid.test.tsx` | Tests for grid component |
| `components/practice/PracticePlay.tsx` | Client wrapper — owns onSessionComplete, renders CardStack |
| `components/dashboard/PracticeBestScores.tsx` | Client — horizontal scroll best-score row |
| `app/(app)/practice/page.tsx` | Server — Practice Hub |
| `app/(app)/practice/[id]/page.tsx` | Server — fetches + shuffles words, renders PracticePlay |
| `app/(app)/practice/[id]/score/page.tsx` | Server — score screen (reads searchParams) |
| `app/admin/practice-groups/page.tsx` | Server — admin list of all groups |
| `app/admin/practice-groups/new/page.tsx` | Client — create group form |
| `app/admin/practice-groups/[id]/page.tsx` | Server — loads group data, renders PracticeGroupEditForm |
| `app/admin/practice-groups/[id]/PracticeGroupEditForm.tsx` | Client — edit form with WordPicker |
| `components/admin/WordPicker.tsx` | Client — search + chip word selector |

### Modified files
| File | Change |
|---|---|
| `lib/types.ts` | Add `PracticeGroupSummary` type |
| `components/game/CardStack.tsx` | Add `mode` + `onSessionComplete` optional props |
| `components/app/AppNav.tsx` | Add Practice to NAV_ITEMS |
| `app/(app)/dashboard/page.tsx` | Add PracticeBestScores section |
| `app/admin/layout.tsx` | Add Practice Groups nav link |

---

## Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/005_practice_module.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/005_practice_module.sql

-- 1. practice_groups
CREATE TABLE practice_groups (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  icon       text NOT NULL,
  is_active  boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE practice_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read active practice groups"
  ON practice_groups FOR SELECT
  USING (is_active = true AND auth.uid() IS NOT NULL);

-- 2. practice_group_words
CREATE TABLE practice_group_words (
  group_id uuid NOT NULL REFERENCES practice_groups(id) ON DELETE CASCADE,
  word_id  uuid NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  position int  NOT NULL CHECK (position BETWEEN 1 AND 20),
  PRIMARY KEY (group_id, word_id)
);

ALTER TABLE practice_group_words ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users read practice group words"
  ON practice_group_words FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 3. practice_sessions
CREATE TABLE practice_sessions (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id  uuid REFERENCES practice_groups(id) ON DELETE SET NULL,
  score_pct int  NOT NULL CHECK (score_pct BETWEEN 0 AND 100),
  played_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE practice_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own practice sessions"
  ON practice_sessions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own practice sessions"
  ON practice_sessions FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- 4. RPC: best scores per group for a user
CREATE OR REPLACE FUNCTION get_user_practice_best_scores(p_user_id uuid)
RETURNS TABLE(group_id uuid, best_score int)
LANGUAGE sql STABLE AS $$
  SELECT group_id, MAX(score_pct)::int AS best_score
  FROM practice_sessions
  WHERE user_id = p_user_id
    AND group_id IS NOT NULL
  GROUP BY group_id;
$$;

-- 5. RPC: atomic word replacement (avoids race window with zero words)
CREATE OR REPLACE FUNCTION replace_practice_group_words(
  p_group_id  uuid,
  p_name      text,
  p_icon      text,
  p_is_active boolean,
  p_word_ids  uuid[]
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE practice_groups
     SET name = p_name, icon = p_icon, is_active = p_is_active
   WHERE id = p_group_id;

  DELETE FROM practice_group_words WHERE group_id = p_group_id;

  INSERT INTO practice_group_words (group_id, word_id, position)
  SELECT p_group_id, unnest(p_word_ids), generate_subscripts(p_word_ids, 1);
END;
$$;
```

- [ ] **Step 2: Run in Supabase SQL Editor**

Open Supabase dashboard → SQL Editor → paste the file contents → Run.
Verify: three new tables appear in Table Editor, two new functions appear in Database → Functions.

- [ ] **Step 3: Commit the migration file**

```bash
git add supabase/migrations/005_practice_module.sql
git commit -m "db: add practice module tables, RLS policies, and RPCs"
```

---

## Task 2: Types

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Add PracticeGroupSummary type**

Add at the bottom of `lib/types.ts`:

```ts
export interface PracticeGroupSummary {
  id: string
  name: string
  icon: string
  word_count: 20
  best_score: number | null
}
```

- [ ] **Step 2: Run tests to confirm no regressions**

```bash
npm test
```
Expected: all existing tests pass.

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "types: add PracticeGroupSummary"
```

---

## Task 3: CardStack — practice mode

**Files:**
- Modify: `components/game/CardStack.tsx`

The existing `CardStack` always calls `/api/progress` per grade and shows its own `ScoreScreen`. In practice mode we skip the API calls and fire `onSessionComplete(scorePct)` when all cards are done.

- [ ] **Step 1: Extend the Props interface and add mode logic**

In `components/game/CardStack.tsx`, replace the `Props` interface and function signature:

```ts
// Replace existing interface Props block:
interface Props {
  initialSet: DailySetResponse
  initialProgress: ProgressResult[]
  mode?: 'daily' | 'practice'
  onSessionComplete?: (scorePct: number) => void
}

export default function CardStack({ initialSet, initialProgress, mode = 'daily', onSessionComplete }: Props) {
```

- [ ] **Step 2: Add a completedRef and useEffect to fire onSessionComplete**

After the existing `gradeBarTimerRef` declaration, add:

```ts
const completedRef = useRef(false)
```

After the existing cleanup `useEffect`, add a new one:

```ts
useEffect(() => {
  if (mode !== 'practice' || currentIdx < total || completedRef.current) return
  completedRef.current = true
  const gotItCount = results.filter(r => r.result === 'got_it').length
  const scorePct = Math.round(gotItCount / total * 100)
  onSessionComplete?.(scorePct)
}, [currentIdx, total, mode, results, onSessionComplete])
```

- [ ] **Step 3: Skip API fetch in handleGrade when mode is practice**

In `handleGrade`, replace the fetch block:

```ts
const handleGrade = async (result: GradeResult) => {
  if (saving || !currentWord) return
  setSaving(true)
  try {
    if (mode === 'daily') {
      const response = await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ set_id, word_id: currentWord.word_id, result }),
      })
      if (!response.ok) {
        console.error('[CardStack] Failed to save grade:', response.status)
      }
    }
  } catch (err) {
    console.error('[CardStack] Network error saving grade:', err)
  }
  setResults(prev => [...prev.filter(p => p.word_id !== currentWord.word_id), { word_id: currentWord.word_id, result }])
  setCurrentIdx(i => i + 1)
  setShowGradeBar(false)
  setSaving(false)
}
```

- [ ] **Step 4: Show loading screen instead of ScoreScreen in practice mode**

Replace the `if (currentIdx >= total)` block:

```ts
if (currentIdx >= total) {
  if (mode === 'practice') {
    return <GameLoadingScreen />  // shown while onSessionComplete fires and parent navigates
  }
  return <ScoreScreen words={words} results={results} onPlayAgain={handlePlayAgain} />
}
```

- [ ] **Step 5: Run tests**

```bash
npm test
```
Expected: all existing tests pass (no breakage to `FlashCard.test.tsx` or `ScoreScreen.test.tsx`).

- [ ] **Step 6: Commit**

```bash
git add components/game/CardStack.tsx
git commit -m "feat: add practice mode to CardStack (skip progress API, fire onSessionComplete)"
```

---

## Task 4: API — POST /api/practice/sessions

**Files:**
- Create: `app/api/practice/sessions/route.ts`
- Create: `app/api/practice/sessions/route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// app/api/practice/sessions/route.test.ts
import { POST } from './route'
import { NextResponse } from 'next/server'

const mockGetUser = jest.fn()
const mockFrom = jest.fn()
const mockServiceFrom = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ auth: { getUser: mockGetUser }, from: mockFrom }),
}))
jest.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({ from: mockServiceFrom }),
}))

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/practice/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/practice/sessions', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await POST(makeRequest({ group_id: 'abc', score_pct: 80 }))
    expect(res.status).toBe(401)
  })

  it('returns 403 when user not approved', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ single: () => ({ data: { is_approved: false } }) }) }),
    })
    const res = await POST(makeRequest({ group_id: 'abc', score_pct: 80 }))
    expect(res.status).toBe(403)
  })

  it('returns 400 for invalid score_pct', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ single: () => ({ data: { is_approved: true } }) }) }),
    })
    const res = await POST(makeRequest({ group_id: 'a'.repeat(36), score_pct: 150 }))
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- --testPathPattern=practice/sessions
```
Expected: FAIL (module not found)

- [ ] **Step 3: Write the implementation**

```ts
// app/api/practice/sessions/route.ts
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: appUser } = await supabase
    .from('users').select('is_approved').eq('id', user.id).single()
  if (!appUser?.is_approved) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const { group_id, score_pct } = (body ?? {}) as Record<string, unknown>

  if (
    typeof group_id !== 'string' || !UUID_RE.test(group_id) ||
    typeof score_pct !== 'number' || !Number.isInteger(score_pct) ||
    score_pct < 0 || score_pct > 100
  ) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const service = createServiceClient()

  // Verify group exists and is active
  const { data: group } = await service
    .from('practice_groups').select('id').eq('id', group_id).eq('is_active', true).single()
  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 })

  // Insert session
  const { data: session, error } = await service
    .from('practice_sessions')
    .insert({ user_id: user.id, group_id, score_pct })
    .select('id, score_pct')
    .single()
  if (error) return NextResponse.json({ error: 'Failed to save' }, { status: 500 })

  // Compute new best
  const { data: bestRow } = await service
    .from('practice_sessions')
    .select('score_pct')
    .eq('user_id', user.id)
    .eq('group_id', group_id)
    .order('score_pct', { ascending: false })
    .limit(1)
    .single()

  const best_score = bestRow?.score_pct ?? score_pct

  // Count prior sessions (before this insert) to detect first play
  const { count } = await service
    .from('practice_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('group_id', group_id)

  const is_new_best = (count ?? 1) <= 1 || score_pct >= best_score

  return NextResponse.json({ id: session.id, score_pct, best_score, is_new_best })
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- --testPathPattern=practice/sessions
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/practice/sessions/route.ts app/api/practice/sessions/route.test.ts
git commit -m "feat: POST /api/practice/sessions — save practice session result"
```

---

## Task 5: API — GET /api/practice/groups

**Files:**
- Create: `app/api/practice/groups/route.ts`
- Create: `app/api/practice/groups/route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// app/api/practice/groups/route.test.ts
import { GET } from './route'

const mockGetUser = jest.fn()
const mockFrom = jest.fn()
const mockRpc = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: () => ({ auth: { getUser: mockGetUser }, from: mockFrom }),
}))
jest.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => ({ from: mockFrom, rpc: mockRpc }),
}))

describe('GET /api/practice/groups', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await GET(new Request('http://localhost/api/practice/groups'))
    expect(res.status).toBe(401)
  })

  it('returns 403 when not approved', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ single: () => ({ data: { is_approved: false } }) }) }),
    })
    const res = await GET(new Request('http://localhost/api/practice/groups'))
    expect(res.status).toBe(403)
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- --testPathPattern=practice/groups
```
Expected: FAIL (module not found)

- [ ] **Step 3: Write the implementation**

```ts
// app/api/practice/groups/route.ts
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: appUser } = await supabase
    .from('users').select('is_approved').eq('id', user.id).single()
  if (!appUser?.is_approved) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const service = createServiceClient()

  const [groupsResult, bestScoresResult] = await Promise.all([
    service.from('practice_groups').select('id, name, icon').eq('is_active', true).order('created_at'),
    service.rpc('get_user_practice_best_scores', { p_user_id: user.id }),
  ])

  const groups = groupsResult.data ?? []
  const bestMap = new Map<string, number>(
    (bestScoresResult.data ?? []).map((r: { group_id: string; best_score: number }) => [r.group_id, r.best_score])
  )

  return NextResponse.json(
    groups.map(g => ({ ...g, best_score: bestMap.get(g.id) ?? null }))
  )
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- --testPathPattern=practice/groups
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/practice/groups/route.ts app/api/practice/groups/route.test.ts
git commit -m "feat: GET /api/practice/groups — active groups with user best scores"
```

---

## Task 6: Admin word search API

**Files:**
- Create: `app/api/admin/practice-groups/words/route.ts`

- [ ] **Step 1: Write the implementation**

```ts
// app/api/admin/practice-groups/words/route.ts
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: appUser } = await supabase
    .from('users').select('is_admin').eq('id', user.id).single()
  if (!appUser?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const q = new URL(request.url).searchParams.get('q') ?? ''
  const service = createServiceClient()

  const { data } = await service
    .from('words')
    .select('id, english_word, thai_translation')
    .ilike('english_word', `%${q}%`)
    .eq('is_deleted', false)
    .limit(20)

  return NextResponse.json(data ?? [])
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/practice-groups/words/route.ts
git commit -m "feat: GET /api/admin/practice-groups/words — word search for admin picker"
```

---

## Task 7: Admin practice groups CRUD API

**Files:**
- Create: `app/api/admin/practice-groups/route.ts`
- Create: `app/api/admin/practice-groups/[id]/route.ts`

- [ ] **Step 1: Write the POST (create) route**

```ts
// app/api/admin/practice-groups/route.ts
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: appUser } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
  return appUser?.is_admin ? user : null
}

export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const { name, icon, is_active, word_ids } = (body ?? {}) as Record<string, unknown>

  if (!name || !icon || !Array.isArray(word_ids)) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }
  if (is_active && word_ids.length !== 20) {
    return NextResponse.json({ error: 'Active groups require exactly 20 words' }, { status: 422 })
  }

  const service = createServiceClient()
  const { data: group, error } = await service
    .from('practice_groups')
    .insert({ name, icon, is_active: !!is_active })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: 'Failed to create' }, { status: 500 })

  if (word_ids.length > 0) {
    await service.rpc('replace_practice_group_words', {
      p_group_id: group.id,
      p_name: name,
      p_icon: icon,
      p_is_active: !!is_active,
      p_word_ids: word_ids,
    })
  }

  return NextResponse.json({ id: group.id }, { status: 201 })
}
```

- [ ] **Step 2: Write the PUT + DELETE route**

```ts
// app/api/admin/practice-groups/[id]/route.ts
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: appUser } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
  return appUser?.is_admin ? user : null
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await request.json().catch(() => null)
  const { name, icon, is_active, word_ids } = (body ?? {}) as Record<string, unknown>

  if (!name || !icon || !Array.isArray(word_ids)) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }
  if (is_active && word_ids.length !== 20) {
    return NextResponse.json({ error: 'Active groups require exactly 20 words' }, { status: 422 })
  }

  const service = createServiceClient()
  const { error } = await service.rpc('replace_practice_group_words', {
    p_group_id: id,
    p_name: name,
    p_icon: icon,
    p_is_active: !!is_active,
    p_word_ids: word_ids,
  })
  if (error) return NextResponse.json({ error: 'Failed to update' }, { status: 500 })

  return NextResponse.json({ ok: true })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const service = createServiceClient()
  const { error } = await service.from('practice_groups').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Run TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/practice-groups/route.ts app/api/admin/practice-groups/[id]/route.ts
git commit -m "feat: admin practice-groups CRUD API (POST, PUT, DELETE)"
```

---

## Task 8: WordPicker component

**Files:**
- Create: `components/admin/WordPicker.tsx`

- [ ] **Step 1: Write the component**

```tsx
// components/admin/WordPicker.tsx
'use client'

import { useState, useRef, useEffect } from 'react'

interface WordResult {
  id: string
  english_word: string
  thai_translation: string
}

interface Props {
  selected: WordResult[]
  onChange: (words: WordResult[]) => void
  maxWords?: number
}

export default function WordPicker({ selected, onChange, maxWords = 20 }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<WordResult[]>([])
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) { setResults([]); return }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/admin/practice-groups/words?q=${encodeURIComponent(query)}`)
        const data = await res.json()
        setResults(data)
      } finally {
        setLoading(false)
      }
    }, 300)
  }, [query])

  const selectedIds = new Set(selected.map(w => w.id))

  const addWord = (word: WordResult) => {
    if (selectedIds.has(word.id) || selected.length >= maxWords) return
    onChange([...selected, word])
    setQuery('')
    setResults([])
  }

  const removeWord = (id: string) => {
    onChange(selected.filter(w => w.id !== id))
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={selected.length >= maxWords ? 'Maximum 20 words reached' : 'Search words…'}
          disabled={selected.length >= maxWords}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 disabled:bg-gray-100"
        />
        {results.length > 0 && (
          <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {results.map(w => (
              <li key={w.id}>
                <button
                  type="button"
                  onClick={() => addWord(w)}
                  disabled={selectedIds.has(w.id)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-purple-50 disabled:text-gray-400 disabled:cursor-default"
                >
                  <span className="font-medium">{w.english_word}</span>
                  <span className="text-gray-400 ml-2">{w.thai_translation}</span>
                  {selectedIds.has(w.id) && <span className="ml-2 text-xs text-green-600">✓ added</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
        {loading && <p className="absolute right-3 top-2 text-xs text-gray-400">Searching…</p>}
      </div>

      <div className="flex flex-wrap gap-2">
        {selected.map(w => (
          <span key={w.id} className="inline-flex items-center gap-1 bg-purple-100 text-purple-800 text-xs font-medium px-2 py-1 rounded-full">
            {w.english_word}
            <button type="button" onClick={() => removeWord(w.id)} className="text-purple-500 hover:text-purple-700">×</button>
          </span>
        ))}
      </div>

      <p className="text-xs text-gray-500">{selected.length} / {maxWords} words selected</p>
    </div>
  )
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/admin/WordPicker.tsx
git commit -m "feat: WordPicker component for admin practice group editor"
```

---

## Task 9: Admin practice groups pages

**Files:**
- Create: `app/admin/practice-groups/page.tsx`
- Create: `app/admin/practice-groups/new/page.tsx`
- Create: `app/admin/practice-groups/[id]/page.tsx`
- Modify: `app/admin/layout.tsx`

- [ ] **Step 1: Write the list page**

```tsx
// app/admin/practice-groups/page.tsx
import { createServiceClient } from '@/lib/supabase/service'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function PracticeGroupsPage() {
  const service = createServiceClient()
  const { data: groups } = await service
    .from('practice_groups')
    .select('id, name, icon, is_active, practice_group_words(count)')
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Practice Groups</h2>
        <Link href="/admin/practice-groups/new"
          className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition">
          + New Group
        </Link>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Group</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Words</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {(groups ?? []).map(g => {
              const wordCount = (g.practice_group_words as unknown as { count: number }[])?.[0]?.count ?? 0
              return (
                <tr key={g.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">
                    <span className="mr-2">{g.icon}</span>{g.name}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{wordCount} / 20</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${g.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {g.is_active ? 'Active' : 'Draft'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/practice-groups/${g.id}`} className="text-purple-600 hover:underline text-sm">
                      Edit
                    </Link>
                  </td>
                </tr>
              )
            })}
            {(groups ?? []).length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No groups yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write the shared form component (new + edit reuse it)**

```tsx
// app/admin/practice-groups/new/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import WordPicker from '@/components/admin/WordPicker'

interface WordResult { id: string; english_word: string; thai_translation: string }

export default function NewPracticeGroupPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('')
  const [isActive, setIsActive] = useState(false)
  const [words, setWords] = useState<WordResult[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const canActivate = words.length === 20

  const handleSave = async () => {
    setError('')
    setSaving(true)
    try {
      const res = await fetch('/api/admin/practice-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, icon, is_active: isActive, word_ids: words.map(w => w.id) }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to save')
        return
      }
      router.push('/admin/practice-groups')
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-xl">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">New Practice Group</h2>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Group Name</label>
          <input value={name} onChange={e => setName(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
            placeholder="e.g. Food & Drinks" />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Icon (emoji)</label>
          <input value={icon} onChange={e => setIcon(e.target.value)} maxLength={2}
            className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-xl text-center focus:outline-none focus:ring-2 focus:ring-purple-400"
            placeholder="🍎" />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Status</label>
          <div className="flex gap-2">
            {(['Draft', 'Active'] as const).map(status => {
              const active = status === 'Active'
              const selected = isActive === active
              const disabled = active && !canActivate
              return (
                <button key={status} type="button"
                  onClick={() => !disabled && setIsActive(active)}
                  disabled={disabled}
                  title={disabled ? 'Add 20 words first' : undefined}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${selected ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'} ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:opacity-80'}`}>
                  {status}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Words</label>
          <WordPicker selected={words} onChange={setWords} />
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button onClick={handleSave} disabled={saving || !name || !icon}
            className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold py-2 rounded-xl text-sm transition">
            {saving ? 'Saving…' : 'Save Group'}
          </button>
          <button onClick={() => router.back()} type="button"
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Write the edit page**

```tsx
// app/admin/practice-groups/[id]/page.tsx
import { createServiceClient } from '@/lib/supabase/service'
import { notFound } from 'next/navigation'
import PracticeGroupEditForm from './PracticeGroupEditForm'

export const dynamic = 'force-dynamic'

export default async function EditPracticeGroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const service = createServiceClient()

  const { data: group } = await service
    .from('practice_groups').select('id, name, icon, is_active').eq('id', id).single()
  if (!group) notFound()

  const { data: wordRows } = await service
    .from('practice_group_words')
    .select('position, words(id, english_word, thai_translation)')
    .eq('group_id', id)
    .order('position')

  const currentWords = (wordRows ?? [])
    .filter((r: any) => r.words)
    .map((r: any) => ({ id: r.words.id, english_word: r.words.english_word, thai_translation: r.words.thai_translation }))

  return <PracticeGroupEditForm group={group} initialWords={currentWords} />
}
```

Create `app/admin/practice-groups/[id]/PracticeGroupEditForm.tsx`:

```tsx
// app/admin/practice-groups/[id]/PracticeGroupEditForm.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import WordPicker from '@/components/admin/WordPicker'

interface WordResult { id: string; english_word: string; thai_translation: string }
interface Group { id: string; name: string; icon: string; is_active: boolean }

export default function PracticeGroupEditForm({ group, initialWords }: { group: Group; initialWords: WordResult[] }) {
  const router = useRouter()
  const [name, setName] = useState(group.name)
  const [icon, setIcon] = useState(group.icon)
  const [isActive, setIsActive] = useState(group.is_active)
  const [words, setWords] = useState<WordResult[]>(initialWords)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const canActivate = words.length === 20

  const handleSave = async () => {
    setError('')
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/practice-groups/${group.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, icon, is_active: isActive, word_ids: words.map(w => w.id) }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to save')
        return
      }
      router.push('/admin/practice-groups')
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    setDeleting(true)
    await fetch(`/api/admin/practice-groups/${group.id}`, { method: 'DELETE' })
    router.push('/admin/practice-groups')
    router.refresh()
  }

  return (
    <div className="max-w-xl">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Edit: {group.name}</h2>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Group Name</label>
          <input value={name} onChange={e => setName(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Icon (emoji)</label>
          <input value={icon} onChange={e => setIcon(e.target.value)} maxLength={2}
            className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-xl text-center focus:outline-none focus:ring-2 focus:ring-purple-400" />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Status</label>
          <div className="flex gap-2">
            {(['Draft', 'Active'] as const).map(status => {
              const active = status === 'Active'
              const selected = isActive === active
              const disabled = active && !canActivate
              return (
                <button key={status} type="button"
                  onClick={() => !disabled && setIsActive(active)}
                  disabled={disabled}
                  title={disabled ? 'Add 20 words first' : undefined}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${selected ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'} ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:opacity-80'}`}>
                  {status}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Words</label>
          <WordPicker selected={words} onChange={setWords} />
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button onClick={handleSave} disabled={saving || !name || !icon}
            className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold py-2 rounded-xl text-sm transition">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          <button onClick={handleDelete} disabled={deleting}
            className="px-4 py-2 text-sm text-red-600 hover:text-red-800 font-semibold">
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Add Practice Groups link to admin nav in `app/admin/layout.tsx`**

Find the `navLinks` array and add the new entry:

```ts
const navLinks = [
  { href: '/admin', label: '📊 Dashboard' },
  { href: '/admin/words', label: '📚 Word Database' },
  { href: '/admin/daily-set', label: '📅 Today\'s Set' },
  { href: '/admin/users', label: '👥 Users' },
  { href: '/admin/practice-groups', label: '🗂️ Practice Groups' },  // ADD THIS LINE
]
```

- [ ] **Step 5: Run TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/admin/practice-groups/ app/admin/layout.tsx components/admin/WordPicker.tsx
git commit -m "feat: admin practice groups pages (list, new, edit) and nav link"
```

---

## Task 10: Practice Hub components (grid + list views)

**Files:**
- Create: `components/practice/PracticeGroupGrid.tsx`
- Create: `components/practice/PracticeGroupList.tsx`
- Create: `components/practice/PracticeGroupGrid.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// components/practice/PracticeGroupGrid.test.tsx
import { render, screen } from '@testing-library/react'
import PracticeGroupGrid from './PracticeGroupGrid'
import type { PracticeGroupSummary } from '@/lib/types'

const groups: PracticeGroupSummary[] = [
  { id: 'g1', name: 'Food & Drinks', icon: '🍎', word_count: 20, best_score: 85 },
  { id: 'g2', name: 'City Life', icon: '🏙️', word_count: 20, best_score: null },
]

describe('PracticeGroupGrid', () => {
  it('renders group names', () => {
    render(<PracticeGroupGrid groups={groups} />)
    expect(screen.getByText('Food & Drinks')).toBeInTheDocument()
    expect(screen.getByText('City Life')).toBeInTheDocument()
  })

  it('renders links to each group', () => {
    render(<PracticeGroupGrid groups={groups} />)
    const links = screen.getAllByRole('link')
    expect(links.some(l => l.getAttribute('href') === '/practice/g1')).toBe(true)
    expect(links.some(l => l.getAttribute('href') === '/practice/g2')).toBe(true)
  })
})
```

- [ ] **Step 2: Run to confirm it fails**

```bash
npm test -- --testPathPattern=PracticeGroupGrid
```
Expected: FAIL

- [ ] **Step 3: Write PracticeGroupGrid**

```tsx
// components/practice/PracticeGroupGrid.tsx
'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { PracticeGroupSummary } from '@/lib/types'

const GRADIENTS = [
  'from-pink-300 to-purple-300',
  'from-teal-200 to-cyan-300',
  'from-yellow-200 to-orange-200',
  'from-blue-200 to-indigo-300',
  'from-green-200 to-teal-200',
  'from-rose-200 to-pink-300',
  'from-purple-200 to-pink-200',
  'from-amber-200 to-yellow-200',
  'from-sky-200 to-blue-200',
  'from-violet-200 to-purple-300',
]

interface Props {
  groups: PracticeGroupSummary[]
  onToggle: () => void
}

export default function PracticeGroupGrid({ groups, onToggle }: Props) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-800">Practice</h1>
        <button onClick={onToggle}
          className="flex items-center gap-1.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition">
          ☰ List
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {groups.map((g, i) => (
          <Link key={g.id} href={`/practice/${g.id}`}
            className={`bg-gradient-to-br ${GRADIENTS[i % GRADIENTS.length]} rounded-2xl p-5 flex flex-col items-center text-center shadow-sm hover:scale-[1.02] transition-transform`}>
            <span className="text-4xl mb-2">{g.icon}</span>
            <span className="font-bold text-white text-sm drop-shadow">{g.name}</span>
            <span className="text-white/80 text-xs mt-1">20 words</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Write PracticeGroupList**

```tsx
// components/practice/PracticeGroupList.tsx
'use client'

import Link from 'next/link'
import { scoreColor } from '@/lib/score-color'
import type { PracticeGroupSummary } from '@/lib/types'

interface Props {
  groups: PracticeGroupSummary[]
  onToggle: () => void
}

export default function PracticeGroupList({ groups, onToggle }: Props) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-800">Practice</h1>
        <button onClick={onToggle}
          className="flex items-center gap-1.5 text-sm font-medium text-white bg-purple-600 rounded-lg px-3 py-1.5 hover:bg-purple-700 transition">
          ⊞ Grid
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {groups.map(g => (
          <Link key={g.id} href={`/practice/${g.id}`}
            className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm hover:bg-gray-50 transition">
            <div className="bg-purple-100 rounded-xl p-2 text-xl">{g.icon}</div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-800 text-sm truncate">{g.name}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                  {g.best_score !== null && (
                    <div
                      className={`h-1.5 rounded-full ${scoreColor(g.best_score)}`}
                      style={{ width: `${g.best_score}%` }}
                    />
                  )}
                </div>
                <span className={`text-xs font-bold ${g.best_score !== null ? '' : 'text-gray-400'}`}
                  style={g.best_score !== null ? {} : {}}>
                  {g.best_score !== null ? `${g.best_score}%` : '—'}
                </span>
              </div>
            </div>
            <span className="text-gray-300 text-lg">›</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Run tests**

```bash
npm test -- --testPathPattern=PracticeGroupGrid
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add components/practice/
git commit -m "feat: PracticeGroupGrid and PracticeGroupList components"
```

---

## Task 11: Practice Hub page

**Files:**
- Create: `app/(app)/practice/page.tsx`

- [ ] **Step 1: Write the page**

This is a server component that fetches data, then renders a client hub switcher.

First create the hub switcher client component inline:

```tsx
// app/(app)/practice/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import type { PracticeGroupSummary } from '@/lib/types'
import PracticeHubClient from './PracticeHubClient'

export const dynamic = 'force-dynamic'

export default async function PracticePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: appUser } = await supabase
    .from('users').select('is_approved').eq('id', user.id).single()
  if (!appUser?.is_approved) redirect('/access-denied')

  const service = createServiceClient()
  const [groupsResult, bestScoresResult] = await Promise.all([
    service.from('practice_groups').select('id, name, icon').eq('is_active', true).order('created_at'),
    service.rpc('get_user_practice_best_scores', { p_user_id: user.id }),
  ])

  const bestMap = new Map<string, number>(
    ((bestScoresResult.data ?? []) as { group_id: string; best_score: number }[])
      .map(r => [r.group_id, r.best_score])
  )

  const groups: PracticeGroupSummary[] = (groupsResult.data ?? []).map(g => ({
    id: g.id,
    name: g.name,
    icon: g.icon,
    word_count: 20,
    best_score: bestMap.get(g.id) ?? null,
  }))

  return (
    <main className="p-4 md:p-8 max-w-2xl">
      <PracticeHubClient groups={groups} />
    </main>
  )
}
```

Create the client hub switcher:

```tsx
// app/(app)/practice/PracticeHubClient.tsx
'use client'

import { useState, useEffect } from 'react'
import PracticeGroupGrid from '@/components/practice/PracticeGroupGrid'
import PracticeGroupList from '@/components/practice/PracticeGroupList'
import type { PracticeGroupSummary } from '@/lib/types'

const STORAGE_KEY = 'practice-view'

export default function PracticeHubClient({ groups }: { groups: PracticeGroupSummary[] }) {
  const [view, setView] = useState<'grid' | 'list'>('grid')

  // Read localStorage after hydration to avoid SSR mismatch
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'list') setView('list')
  }, [])

  const toggle = () => {
    const next = view === 'grid' ? 'list' : 'grid'
    setView(next)
    localStorage.setItem(STORAGE_KEY, next)
  }

  if (groups.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-4xl mb-3">📚</p>
        <p>No practice groups available yet.</p>
      </div>
    )
  }

  return view === 'grid'
    ? <PracticeGroupGrid groups={groups} onToggle={toggle} />
    : <PracticeGroupList groups={groups} onToggle={toggle} />
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/\(app\)/practice/
git commit -m "feat: Practice Hub page (server component with grid/list toggle)"
```

---

## Task 12: Practice Play page + PracticePlay client component

**Files:**
- Create: `app/(app)/practice/[id]/page.tsx`
- Create: `components/practice/PracticePlay.tsx`

- [ ] **Step 1: Write the Fisher-Yates shuffle helper (inline in the page)**

```tsx
// app/(app)/practice/[id]/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { toBangkokDateString } from '@/lib/bangkok-date'
import PracticePlay from '@/components/practice/PracticePlay'
import type { DailySetResponse } from '@/lib/types'

function fisherYates<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export const dynamic = 'force-dynamic'

export default async function PracticePlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: appUser } = await supabase
    .from('users').select('is_approved').eq('id', user.id).single()
  if (!appUser?.is_approved) redirect('/access-denied')

  const service = createServiceClient()

  const { data: group } = await service
    .from('practice_groups').select('id, name').eq('id', id).eq('is_active', true).single()
  if (!group) redirect('/practice')

  const { data: wordRows } = await service
    .from('practice_group_words')
    .select('position, words(english_word, thai_translation, image_url, audio_url, part_of_speech, english_example, thai_example)')
    .eq('group_id', id)
    .order('position')

  const words = fisherYates(
    (wordRows ?? [])
      .filter((r: any) => r.words)
      .map((r: any, idx: number) => ({
        word_id: `${id}-${idx}`,   // stable key — no real word_id needed in practice mode
        position: idx + 1,
        english_word: r.words.english_word,
        thai_translation: r.words.thai_translation,
        image_url: r.words.image_url,
        audio_url: r.words.audio_url,
        part_of_speech: r.words.part_of_speech ?? null,
        english_example: r.words.english_example ?? null,
        thai_example: r.words.thai_example ?? null,
      }))
  )

  const practiceSet: DailySetResponse = {
    set_id: id,
    set_date: toBangkokDateString(),
    words,
  }

  return (
    <main className="flex flex-col items-center pt-2">
      <PracticePlay groupId={id} practiceSet={practiceSet} />
    </main>
  )
}
```

- [ ] **Step 2: Write PracticePlay client component**

```tsx
// components/practice/PracticePlay.tsx
'use client'

import { useRouter } from 'next/navigation'
import CardStack from '@/components/game/CardStack'
import type { DailySetResponse } from '@/lib/types'

interface Props {
  groupId: string
  practiceSet: DailySetResponse
}

export default function PracticePlay({ groupId, practiceSet }: Props) {
  const router = useRouter()

  const handleSessionComplete = async (scorePct: number) => {
    try {
      const res = await fetch('/api/practice/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: groupId, score_pct: scorePct }),
      })
      if (res.ok) {
        const { best_score, is_new_best } = await res.json()
        router.push(`/practice/${groupId}/score?pct=${scorePct}&best=${best_score}&new=${is_new_best ? 1 : 0}`)
      } else {
        // Fallback: navigate without best score data
        router.push(`/practice/${groupId}/score?pct=${scorePct}&best=${scorePct}&new=1`)
      }
    } catch {
      router.push(`/practice/${groupId}/score?pct=${scorePct}&best=${scorePct}&new=1`)
    }
  }

  return (
    <CardStack
      initialSet={practiceSet}
      initialProgress={[]}
      mode="practice"
      onSessionComplete={handleSessionComplete}
    />
  )
}
```

- [ ] **Step 3: Run TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/\(app\)/practice/\[id\]/ components/practice/PracticePlay.tsx
git commit -m "feat: Practice Play page — fetches, shuffles, and launches CardStack in practice mode"
```

---

## Task 13: Practice Score screen

**Files:**
- Create: `app/(app)/practice/[id]/score/page.tsx`

- [ ] **Step 1: Write the score screen**

```tsx
// app/(app)/practice/[id]/score/page.tsx
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { scoreColor } from '@/lib/score-color'

export default async function PracticeScorePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ pct?: string; best?: string; new?: string }>
}) {
  const { id } = await params
  const sp = await searchParams

  const pct  = Math.min(100, Math.max(0, parseInt(sp.pct  ?? '0', 10) || 0))
  const best = Math.min(100, Math.max(0, parseInt(sp.best ?? '0', 10) || 0))
  const isNewBest = sp.new === '1'

  const service = createServiceClient()
  const { data: group } = await service
    .from('practice_groups').select('name, icon').eq('id', id).single()

  if (!group) redirect('/practice')

  // Map bg- classes to text- equivalents (explicit so Tailwind JIT includes them)
  const bgToText: Record<string, string> = {
    'bg-green-600': 'text-green-600',
    'bg-green-300': 'text-green-500',
    'bg-amber-400': 'text-amber-500',
    'bg-red-500':   'text-red-500',
  }
  const pctColor = bgToText[scoreColor(pct)] ?? 'text-gray-700'
  const bestColor = bgToText[scoreColor(best)] ?? 'text-gray-700'

  return (
    <main className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="bg-white rounded-3xl shadow-lg p-8 w-full max-w-sm flex flex-col items-center gap-4 text-center">
        <span className="text-5xl">{group.icon}</span>
        <h2 className="text-lg font-bold text-gray-800">{group.name}</h2>

        {isNewBest && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-2 text-yellow-700 text-sm font-semibold">
            New best score! 🎉
          </div>
        )}

        <div className="w-full">
          <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Your Score</p>
          <p className={`text-5xl font-bold ${pctColor.replace('bg-', 'text-')}`}>{pct}%</p>
        </div>

        <div className="w-full border-t pt-3">
          <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Your Best</p>
          <p className={`text-2xl font-bold ${bestColor.replace('bg-', 'text-')}`}>{best}%</p>
        </div>

        <div className="flex flex-col gap-2 w-full mt-2">
          <Link href={`/practice/${id}`}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-2xl text-sm transition text-center">
            🔄 Play Again
          </Link>
          <Link href="/practice"
            className="w-full text-gray-500 hover:text-gray-700 font-medium py-2 text-sm text-center">
            ← Back to Practice
          </Link>
        </div>
      </div>
    </main>
  )
}
```

**Note on colour:** `scoreColor()` returns Tailwind background classes (`bg-green-600` etc.). For text colour, replace `bg-` with `text-`.

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/\(app\)/practice/\[id\]/score/
git commit -m "feat: Practice score screen — shows score, personal best, and new best banner"
```

---

## Task 14: PracticeBestScores + Dashboard update

**Files:**
- Create: `components/dashboard/PracticeBestScores.tsx`
- Modify: `app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Write PracticeBestScores**

```tsx
// components/dashboard/PracticeBestScores.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { scoreColor } from '@/lib/score-color'

interface GroupScore {
  id: string
  name: string
  icon: string
  best_score: number | null
}

export default function PracticeBestScores() {
  const [groups, setGroups] = useState<GroupScore[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/practice/groups')
      .then(r => r.ok ? r.json() : [])
      .then(setGroups)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return null  // no flash of empty state

  if (groups.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mt-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Practice</h2>
        <p className="text-sm text-gray-400">No practice scores yet — try a group!</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mt-4">
      <h2 className="text-sm font-semibold text-gray-700 mb-4">Practice — Best Scores</h2>
      <div className="flex gap-4 overflow-x-auto pb-1">
        {groups.map(g => (
          <Link key={g.id} href={`/practice/${g.id}`}
            className="flex flex-col items-center gap-1.5 flex-shrink-0 w-16 hover:opacity-80 transition">
            <span className="text-2xl">{g.icon}</span>
            <span className="text-xs text-gray-600 font-medium text-center w-full overflow-hidden text-ellipsis whitespace-nowrap">
              {g.name}
            </span>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              {g.best_score !== null && (
                <div
                  className={`h-1.5 rounded-full ${scoreColor(g.best_score)}`}
                  style={{ width: `${g.best_score}%` }}
                />
              )}
            </div>
            <span className="text-xs font-bold" style={{ color: g.best_score !== null ? 'inherit' : '#9ca3af' }}>
              {g.best_score !== null ? `${g.best_score}%` : '—'}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add PracticeBestScores to the dashboard**

In `app/(app)/dashboard/page.tsx`, add the import and render it below the stat cards section:

```tsx
// Add import at top:
import PracticeBestScores from '@/components/dashboard/PracticeBestScores'

// Add below the stat cards section (after the closing </div> of the stat cards block):
<PracticeBestScores />
```

- [ ] **Step 3: Run TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Run all tests**

```bash
npm test
```
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/PracticeBestScores.tsx app/\(app\)/dashboard/page.tsx
git commit -m "feat: PracticeBestScores component and dashboard integration"
```

---

## Task 15: Add Practice to nav + deploy

**Files:**
- Modify: `components/app/AppNav.tsx`

- [ ] **Step 1: Add Practice to NAV_ITEMS**

In `components/app/AppNav.tsx`, add the Practice entry:

```ts
export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: '🏠', mobileLabel: 'Home' },
  { label: 'Play Game',  href: '/play',      icon: '🎮', mobileLabel: 'Play' },
  { label: 'Practice',  href: '/practice',  icon: '📚', mobileLabel: 'Practice' },  // ADD
  { label: 'Settings',  href: '/settings',  icon: '⚙️', mobileLabel: 'Settings' },
]
```

- [ ] **Step 2: Full TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Run all tests**

```bash
npm test
```
Expected: all tests pass.

- [ ] **Step 4: Commit and push**

```bash
git add components/app/AppNav.tsx
git commit -m "feat: add Practice nav item"
git push
```

Vercel will deploy automatically. Once deployed, verify:
1. Practice tab appears in sidebar (desktop) and bottom bar (mobile)
2. `/practice` loads the hub page with grid/list toggle
3. Admin `/admin/practice-groups` shows the list with "+ New Group"
4. Creating a group → searching words → saving works end-to-end
5. Playing a group → score screen shows current score + best
6. Dashboard shows the Practice section with best scores
