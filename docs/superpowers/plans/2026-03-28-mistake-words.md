# Mistake Words Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record "Nope" clicks during practice sessions into a per-user mistake list, let users review those words on a dedicated page, and retake them (max 20, shuffled) with "Got it!" removing words from the list.

**Architecture:** New `mistake_words` table (user_id, word_id PK) stores mistakes. `CardStack` gains `mode='retake'` which fires non-blocking DELETE on "Got it!" and a new `onRetakeComplete` callback when done. The practice play page gains non-blocking POST on "Nope". All pages are server components (direct Supabase queries) except the score page which reads sessionStorage.

**Tech Stack:** Next.js 16 App Router, Supabase (RLS), TypeScript, Tailwind CSS, Jest

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `supabase/migrations/006_mistake_words.sql` | Create | `mistake_words` table + RLS |
| `lib/types.ts` | Modify | Add `MistakeWord` interface |
| `app/api/mistake-words/route.ts` | Create | GET (list) + POST (add word) |
| `app/api/mistake-words/route.test.ts` | Create | Tests for GET + POST |
| `app/api/mistake-words/[word_id]/route.ts` | Create | DELETE (remove word) |
| `app/api/mistake-words/[word_id]/route.test.ts` | Create | Tests for DELETE |
| `components/game/CardStack.tsx` | Modify | Add `retake` mode, nope-recording, got_it-removal |
| `components/dashboard/MistakeWordsCard.tsx` | Create | Server component — count card |
| `app/(app)/dashboard/page.tsx` | Modify | Replace `<StatCard placeholder />` |
| `app/(app)/mistake-words/page.tsx` | Create | Server page — auth + fetch words |
| `components/mistake-words/MistakeWordsClient.tsx` | Create | Word list + Retake button |
| `app/(app)/mistake-words/retake/page.tsx` | Create | Server page — auth + shuffle + slice 20 |
| `components/mistake-words/MistakeRetakePlay.tsx` | Create | Client — wraps CardStack retake mode |
| `app/(app)/mistake-words/retake/score/page.tsx` | Create | Client — reads sessionStorage, renders score |
| `components/mistake-words/MistakeRetakeScore.tsx` | Create | Chip breakdown + back button |

---

## Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/006_mistake_words.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/006_mistake_words.sql

CREATE TABLE mistake_words (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  word_id    uuid NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, word_id)
);

ALTER TABLE mistake_words ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own mistake words"
  ON mistake_words FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own mistake words"
  ON mistake_words FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own mistake words"
  ON mistake_words FOR DELETE
  USING (user_id = auth.uid());
```

- [ ] **Step 2: Run the migration in Supabase**

Open the Supabase SQL editor, paste the migration, and confirm. The warning about destructive operations is expected (the `DELETE` policy uses that keyword) — confirm and proceed.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/006_mistake_words.sql
git commit -m "db: add mistake_words table with RLS"
```

---

## Task 2: Types

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Add `MistakeWord` interface**

Append to `lib/types.ts`:

```typescript
export interface MistakeWord {
  word_id: string
  english_word: string
  part_of_speech: string | null
  thai_translation: string
  english_example: string | null
  thai_example: string | null
  image_url: string | null
  audio_url: string | null
  created_at: string
}
```

- [ ] **Step 2: Verify no TS errors**

```bash
npx tsc --noEmit
```

Expected: no output (clean).

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "types: add MistakeWord interface"
```

---

## Task 3: API Routes — GET, POST, DELETE

**Files:**
- Create: `app/api/mistake-words/route.ts`
- Create: `app/api/mistake-words/route.test.ts`
- Create: `app/api/mistake-words/[word_id]/route.ts`
- Create: `app/api/mistake-words/[word_id]/route.test.ts`

- [ ] **Step 1: Write failing tests for GET + POST**

Create `app/api/mistake-words/route.test.ts`:

```typescript
/** @jest-environment node */
import { GET, POST } from './route'

const mockSelect = jest.fn()
const mockEq = jest.fn()
const mockOrder = jest.fn()
const mockFrom = jest.fn(() => ({ select: mockSelect }))
mockSelect.mockReturnValue({ eq: mockEq })
mockEq.mockReturnValue({ order: mockOrder })
mockOrder.mockResolvedValue({ data: [] })

const mockGetUser = jest.fn()
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}))

describe('GET /api/mistake-words', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns 403 when not approved', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockFrom.mockReturnValueOnce({
      select: jest.fn(() => ({ eq: jest.fn(() => ({ single: jest.fn().mockResolvedValue({ data: { is_approved: false } }) })) })),
    })
    const res = await GET()
    expect(res.status).toBe(403)
  })
})

describe('POST /api/mistake-words', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await POST(new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ word_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' }),
    }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid word_id', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockFrom.mockReturnValueOnce({
      select: jest.fn(() => ({ eq: jest.fn(() => ({ single: jest.fn().mockResolvedValue({ data: { is_approved: true } }) })) })),
    })
    const res = await POST(new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ word_id: 'not-a-uuid' }),
    }))
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd flashcard-app && npx jest app/api/mistake-words/route.test.ts --no-coverage
```

Expected: FAIL — `route.ts` does not exist yet.

- [ ] **Step 3: Implement GET + POST**

Create `app/api/mistake-words/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function requireApprovedUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, supabase, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: appUser } = await supabase.from('users').select('is_approved').eq('id', user.id).single()
  if (!appUser?.is_approved) return { user: null, supabase, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { user, supabase, error: null }
}

export async function GET() {
  const { user, supabase, error } = await requireApprovedUser()
  if (error) return error

  const { data, error: dbError } = await supabase
    .from('mistake_words')
    .select(`
      word_id,
      created_at,
      words (
        english_word,
        part_of_speech,
        thai_translation,
        english_example,
        thai_example,
        image_url,
        audio_url
      )
    `)
    .order('created_at', { ascending: false })

  if (dbError) return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })

  interface Row {
    word_id: string
    created_at: string
    words: {
      english_word: string
      part_of_speech: string | null
      thai_translation: string
      english_example: string | null
      thai_example: string | null
      image_url: string | null
      audio_url: string | null
    } | null
  }

  const result = ((data ?? []) as unknown as Row[])
    .filter(r => r.words !== null)
    .map(r => ({
      word_id: r.word_id,
      english_word: r.words!.english_word,
      part_of_speech: r.words!.part_of_speech,
      thai_translation: r.words!.thai_translation,
      english_example: r.words!.english_example,
      thai_example: r.words!.thai_example,
      image_url: r.words!.image_url,
      audio_url: r.words!.audio_url,
      created_at: r.created_at,
    }))

  return NextResponse.json(result)
}

export async function POST(request: Request) {
  const { user, supabase, error } = await requireApprovedUser()
  if (error) return error

  const body = await request.json().catch(() => null)
  const { word_id } = (body ?? {}) as Record<string, unknown>

  if (typeof word_id !== 'string' || !UUID_RE.test(word_id)) {
    return NextResponse.json({ error: 'Invalid word_id' }, { status: 400 })
  }

  // Verify word exists and is not deleted
  const { data: word } = await supabase
    .from('words').select('id').eq('id', word_id).eq('is_deleted', false).single()
  if (!word) return NextResponse.json({ error: 'Word not found' }, { status: 404 })

  await supabase
    .from('mistake_words')
    .upsert({ user_id: user!.id, word_id }, { onConflict: 'user_id,word_id', ignoreDuplicates: true })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest app/api/mistake-words/route.test.ts --no-coverage
```

Expected: PASS (4 tests).

- [ ] **Step 5: Write failing test for DELETE**

Create `app/api/mistake-words/[word_id]/route.test.ts`:

```typescript
/** @jest-environment node */
import { DELETE } from './route'

const mockGetUser = jest.fn()
const mockFrom = jest.fn()
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}))

describe('DELETE /api/mistake-words/[word_id]', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await DELETE(new Request('http://localhost'), {
      params: Promise.resolve({ word_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' }),
    })
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid word_id', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    mockFrom.mockReturnValueOnce({
      select: jest.fn(() => ({ eq: jest.fn(() => ({ single: jest.fn().mockResolvedValue({ data: { is_approved: true } }) })) })),
    })
    const res = await DELETE(new Request('http://localhost'), {
      params: Promise.resolve({ word_id: 'not-a-uuid' }),
    })
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

```bash
npx jest "app/api/mistake-words/\[word_id\]/route.test.ts" --no-coverage
```

Expected: FAIL.

- [ ] **Step 7: Implement DELETE**

Create `app/api/mistake-words/[word_id]/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ word_id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: appUser } = await supabase
    .from('users').select('is_approved').eq('id', user.id).single()
  if (!appUser?.is_approved) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { word_id } = await params
  if (!UUID_RE.test(word_id)) {
    return NextResponse.json({ error: 'Invalid word_id' }, { status: 400 })
  }

  await supabase
    .from('mistake_words')
    .delete()
    .eq('user_id', user.id)
    .eq('word_id', word_id)

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 8: Run all tests to verify they pass**

```bash
npx jest "app/api/mistake-words" --no-coverage
```

Expected: PASS (6 tests total).

- [ ] **Step 9: Commit**

```bash
git add app/api/mistake-words/
git commit -m "feat: GET/POST /api/mistake-words and DELETE /api/mistake-words/[word_id]"
```

---

## Task 4: CardStack — Retake Mode

**Files:**
- Modify: `components/game/CardStack.tsx`

This task extends CardStack with three behaviours:
1. `mode='retake'` — skips `/api/progress`, calls `onRetakeComplete(gotItIds, nopeIds)` when done
2. Practice "Nope" → non-blocking POST to `/api/mistake-words`
3. Retake "Got it!" → non-blocking DELETE from `/api/mistake-words/[word_id]`

- [ ] **Step 1: Update the Props interface**

In `components/game/CardStack.tsx`, replace:

```typescript
interface Props {
  initialSet: DailySetResponse
  initialProgress: ProgressResult[]
  mode?: 'daily' | 'practice'
  onSessionComplete?: (scorePct: number) => void
}
```

with:

```typescript
interface Props {
  initialSet: DailySetResponse
  initialProgress: ProgressResult[]
  mode?: 'daily' | 'practice' | 'retake'
  onSessionComplete?: (scorePct: number) => void
  onRetakeComplete?: (gotItWordIds: string[], nopeWordIds: string[]) => void
}
```

And update the function signature line to destructure the new prop:

```typescript
export default function CardStack({ initialSet, initialProgress, mode = 'daily', onSessionComplete, onRetakeComplete }: Props) {
```

- [ ] **Step 2: Add retake completion effect**

The existing `useEffect` fires `onSessionComplete` for practice mode. Add a **second** effect directly after it for retake mode:

```typescript
  // Existing effect (unchanged — practice mode only)
  useEffect(() => {
    if (mode !== 'practice' || currentIdx < total || completedRef.current) return
    completedRef.current = true
    const gotItCount = results.filter(r => r.result === 'got_it').length
    const scorePct = Math.round(gotItCount / total * 100)
    onSessionComplete?.(scorePct)
  }, [currentIdx, total, mode, results, onSessionComplete])

  // NEW — retake mode completion
  useEffect(() => {
    if (mode !== 'retake' || currentIdx < total || completedRef.current) return
    completedRef.current = true
    const gotItWordIds = results.filter(r => r.result === 'got_it').map(r => r.word_id)
    const nopeWordIds  = results.filter(r => r.result === 'nope').map(r => r.word_id)
    onRetakeComplete?.(gotItWordIds, nopeWordIds)
  }, [currentIdx, total, mode, results, onRetakeComplete])
```

- [ ] **Step 3: Update handleGrade for nope-recording and got_it-removal**

Replace the existing `handleGrade` function with:

```typescript
  const handleGrade = async (result: GradeResult) => {
    if (saving || !currentWord) return
    setSaving(true)

    // Daily mode: blocking save to /api/progress
    if (mode === 'daily') {
      try {
        const response = await fetch('/api/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ set_id, word_id: currentWord.word_id, result }),
        })
        if (!response.ok) console.error('[CardStack] Failed to save grade:', response.status)
      } catch (err) {
        console.error('[CardStack] Network error saving grade:', err)
      }
    }

    // Practice mode: non-blocking nope recording
    if (mode === 'practice' && result === 'nope') {
      fetch('/api/mistake-words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word_id: currentWord.word_id }),
      }).catch(err => console.error('[CardStack] Failed to record mistake word:', err))
    }

    // Retake mode: non-blocking removal on got_it
    if (mode === 'retake' && result === 'got_it') {
      fetch(`/api/mistake-words/${currentWord.word_id}`, {
        method: 'DELETE',
      }).catch(err => console.error('[CardStack] Failed to remove mistake word:', err))
    }

    setResults(prev => [...prev.filter(p => p.word_id !== currentWord.word_id), { word_id: currentWord.word_id, result }])
    setCurrentIdx(i => i + 1)
    setShowGradeBar(false)
    setSaving(false)
  }
```

- [ ] **Step 4: Update the render guard for retake mode**

Replace:

```typescript
  if (currentIdx >= total) {
    if (mode === 'practice') {
      return <GameLoadingScreen />
    }
    return <ScoreScreen words={words} results={results} onPlayAgain={handlePlayAgain} />
  }
```

with:

```typescript
  if (currentIdx >= total) {
    if (mode === 'practice' || mode === 'retake') {
      return <GameLoadingScreen />
    }
    return <ScoreScreen words={words} results={results} onPlayAgain={handlePlayAgain} />
  }
```

- [ ] **Step 5: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add components/game/CardStack.tsx
git commit -m "feat: add retake mode to CardStack with nope-recording and got_it-removal"
```

---

## Task 5: MistakeWordsCard + Dashboard

**Files:**
- Create: `components/dashboard/MistakeWordsCard.tsx`
- Modify: `app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Create MistakeWordsCard**

Create `components/dashboard/MistakeWordsCard.tsx`:

```typescript
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

interface Props {
  userId: string
}

export default async function MistakeWordsCard({ userId }: Props) {
  const supabase = await createClient()
  const { count } = await supabase
    .from('mistake_words')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  const total = count ?? 0

  return (
    <Link href="/mistake-words" className="flex-1 block">
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm h-full relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-orange-400 to-red-400" />
        <p className="text-xs font-semibold text-orange-500 uppercase tracking-wide mb-1">Mistake Words</p>
        {total > 0 ? (
          <>
            <p className="text-xl font-bold text-gray-800">{total}</p>
            <p className="text-xs text-gray-400 mt-0.5">words to review →</p>
          </>
        ) : (
          <>
            <p className="text-xl font-bold text-green-600">0</p>
            <p className="text-xs text-gray-400 mt-0.5">all clear ✓</p>
          </>
        )}
      </div>
    </Link>
  )
}
```

- [ ] **Step 2: Update dashboard to use MistakeWordsCard**

In `app/(app)/dashboard/page.tsx`:

1. Add import at the top (with other dashboard imports):
```typescript
import MistakeWordsCard from '@/components/dashboard/MistakeWordsCard'
```

2. Replace `<StatCard placeholder />` with `<MistakeWordsCard userId={user.id} />`:

```typescript
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
          <MistakeWordsCard userId={user.id} />
        </div>
      )}
```

- [ ] **Step 3: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/MistakeWordsCard.tsx app/'(app)'/dashboard/page.tsx
git commit -m "feat: MistakeWordsCard on dashboard (replaces Coming Soon)"
```

---

## Task 6: Mistake Words Page

**Files:**
- Create: `app/(app)/mistake-words/page.tsx`
- Create: `components/mistake-words/MistakeWordsClient.tsx`

- [ ] **Step 1: Create MistakeWordsClient**

Create `components/mistake-words/MistakeWordsClient.tsx`:

```typescript
'use client'

import Link from 'next/link'
import type { MistakeWord } from '@/lib/types'

interface Props {
  words: MistakeWord[]
}

export default function MistakeWordsClient({ words }: Props) {
  const retakeCount = Math.min(words.length, 20)
  const canRetake = words.length >= 2

  return (
    <div>
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-800">😢 Mistake Words</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {words.length} word{words.length !== 1 ? 's' : ''} to review
          </p>
        </div>
        <Link
          href="/mistake-words/retake"
          aria-disabled={!canRetake}
          tabIndex={canRetake ? undefined : -1}
          className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition shrink-0 ${
            canRetake
              ? 'bg-purple-600 text-white hover:bg-purple-700'
              : 'bg-gray-200 text-gray-400 pointer-events-none'
          }`}
        >
          Retake ({retakeCount})
        </Link>
      </div>

      {words.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">🎉</p>
          <p className="font-medium">No mistakes yet — keep it up!</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {words.map(w => (
          <div key={w.word_id} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-base font-bold text-gray-800">{w.english_word}</span>
              {w.part_of_speech && (
                <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                  {w.part_of_speech}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-700 mb-1">{w.thai_translation}</p>
            {(w.english_example || w.thai_example) && (
              <p className="text-xs text-gray-400 italic">
                {[w.english_example, w.thai_example].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create the server page**

Create `app/(app)/mistake-words/page.tsx`:

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MistakeWordsClient from '@/components/mistake-words/MistakeWordsClient'
import type { MistakeWord } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function MistakeWordsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: appUser } = await supabase
    .from('users').select('is_approved').eq('id', user.id).single()
  if (!appUser?.is_approved) redirect('/access-denied')

  const { data } = await supabase
    .from('mistake_words')
    .select(`
      word_id,
      created_at,
      words (
        english_word,
        part_of_speech,
        thai_translation,
        english_example,
        thai_example,
        image_url,
        audio_url
      )
    `)
    .order('created_at', { ascending: false })

  interface Row {
    word_id: string
    created_at: string
    words: {
      english_word: string
      part_of_speech: string | null
      thai_translation: string
      english_example: string | null
      thai_example: string | null
      image_url: string | null
      audio_url: string | null
    } | null
  }

  const words: MistakeWord[] = ((data ?? []) as unknown as Row[])
    .filter(r => r.words !== null)
    .map(r => ({
      word_id: r.word_id,
      english_word: r.words!.english_word,
      part_of_speech: r.words!.part_of_speech,
      thai_translation: r.words!.thai_translation,
      english_example: r.words!.english_example,
      thai_example: r.words!.thai_example,
      image_url: r.words!.image_url,
      audio_url: r.words!.audio_url,
      created_at: r.created_at,
    }))

  return (
    <main className="p-4 md:p-8 max-w-lg">
      <MistakeWordsClient words={words} />
    </main>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/mistake-words/" components/mistake-words/MistakeWordsClient.tsx
git commit -m "feat: Mistake Words page — list view with Retake button"
```

---

## Task 7: Retake Play Page

**Files:**
- Create: `app/(app)/mistake-words/retake/page.tsx`
- Create: `components/mistake-words/MistakeRetakePlay.tsx`

- [ ] **Step 1: Create MistakeRetakePlay**

Create `components/mistake-words/MistakeRetakePlay.tsx`:

```typescript
'use client'

import { useRouter } from 'next/navigation'
import CardStack from '@/components/game/CardStack'
import type { DailySetResponse, MistakeWord } from '@/lib/types'

interface RetakeWord {
  word_id: string
  english_word: string
}

interface Props {
  words: MistakeWord[]
}

export default function MistakeRetakePlay({ words }: Props) {
  const router = useRouter()

  const retakeSet: DailySetResponse = {
    set_id: 'retake',
    set_date: new Date().toISOString().split('T')[0],
    words: words.map((w, idx) => ({
      word_id: w.word_id,
      position: idx + 1,
      english_word: w.english_word,
      thai_translation: w.thai_translation,
      image_url: w.image_url,
      audio_url: w.audio_url,
      part_of_speech: w.part_of_speech,
      english_example: w.english_example,
      thai_example: w.thai_example,
    })),
  }

  const handleRetakeComplete = (gotItWordIds: string[], nopeWordIds: string[]) => {
    const toWord = (id: string): RetakeWord => {
      const w = words.find(x => x.word_id === id)!
      return { word_id: id, english_word: w.english_word }
    }
    const payload = {
      gotItWords: gotItWordIds.map(toWord),
      nopeWords:  nopeWordIds.map(toWord),
    }
    sessionStorage.setItem('retake_results', JSON.stringify(payload))
    router.push('/mistake-words/retake/score')
  }

  return (
    <CardStack
      initialSet={retakeSet}
      initialProgress={[]}
      mode="retake"
      onRetakeComplete={handleRetakeComplete}
    />
  )
}
```

- [ ] **Step 2: Create the server page**

Create `app/(app)/mistake-words/retake/page.tsx`:

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MistakeRetakePlay from '@/components/mistake-words/MistakeRetakePlay'
import type { MistakeWord } from '@/lib/types'

function fisherYates<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export const dynamic = 'force-dynamic'

export default async function MistakeRetakePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: appUser } = await supabase
    .from('users').select('is_approved').eq('id', user.id).single()
  if (!appUser?.is_approved) redirect('/access-denied')

  const { data } = await supabase
    .from('mistake_words')
    .select(`
      word_id,
      created_at,
      words (
        english_word,
        part_of_speech,
        thai_translation,
        english_example,
        thai_example,
        image_url,
        audio_url
      )
    `)

  interface Row {
    word_id: string
    created_at: string
    words: {
      english_word: string
      part_of_speech: string | null
      thai_translation: string
      english_example: string | null
      thai_example: string | null
      image_url: string | null
      audio_url: string | null
    } | null
  }

  const allWords: MistakeWord[] = ((data ?? []) as unknown as Row[])
    .filter(r => r.words !== null)
    .map(r => ({
      word_id: r.word_id,
      english_word: r.words!.english_word,
      part_of_speech: r.words!.part_of_speech,
      thai_translation: r.words!.thai_translation,
      english_example: r.words!.english_example,
      thai_example: r.words!.thai_example,
      image_url: r.words!.image_url,
      audio_url: r.words!.audio_url,
      created_at: r.created_at,
    }))

  // Guard: need at least 2 words to retake
  if (allWords.length < 2) redirect('/mistake-words')

  const words = fisherYates(allWords).slice(0, 20)

  return (
    <main className="flex flex-col items-center pt-2">
      <MistakeRetakePlay words={words} />
    </main>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/mistake-words/retake/" components/mistake-words/MistakeRetakePlay.tsx
git commit -m "feat: Mistake Words retake play page"
```

---

## Task 8: Retake Score Page

**Files:**
- Create: `app/(app)/mistake-words/retake/score/page.tsx`
- Create: `components/mistake-words/MistakeRetakeScore.tsx`

- [ ] **Step 1: Create MistakeRetakeScore**

Create `components/mistake-words/MistakeRetakeScore.tsx`:

```typescript
'use client'

import { useRouter } from 'next/navigation'

interface RetakeWord {
  word_id: string
  english_word: string
}

interface Props {
  gotItWords: RetakeWord[]
  nopeWords: RetakeWord[]
}

export default function MistakeRetakeScore({ gotItWords, nopeWords }: Props) {
  const router = useRouter()
  const total = gotItWords.length + nopeWords.length

  return (
    <main className="flex flex-col items-center px-4 py-8 max-w-lg mx-auto">
      <div className="bg-white rounded-3xl shadow-lg p-8 w-full flex flex-col gap-6">
        {/* Score summary */}
        <div className="text-center">
          <p className="text-5xl font-extrabold text-purple-600">
            {gotItWords.length}/{total}
          </p>
          {gotItWords.length > 0 && (
            <p className="text-sm text-gray-500 mt-2">
              {gotItWords.length} word{gotItWords.length !== 1 ? 's' : ''} cleared from your Mistake Words ✅
            </p>
          )}
          {nopeWords.length > 0 && (
            <p className="text-sm text-orange-500 mt-1">
              {nopeWords.length} word{nopeWords.length !== 1 ? 's' : ''} still remaining — keep practising!
            </p>
          )}
        </div>

        {/* Got it section */}
        {gotItWords.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
              <span className="text-sm font-semibold text-green-700">Got it! · {gotItWords.length} cleared</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {gotItWords.map(w => (
                <span key={w.word_id} className="bg-green-50 text-green-700 text-sm px-3 py-1 rounded-lg font-medium border border-green-100">
                  {w.english_word}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Nope section */}
        {nopeWords.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />
              <span className="text-sm font-semibold text-red-600">Nope · {nopeWords.length} still in Mistake Words</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {nopeWords.map(w => (
                <span key={w.word_id} className="bg-red-50 text-red-600 text-sm px-3 py-1 rounded-lg font-medium border border-red-100">
                  {w.english_word}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <button
          onClick={() => router.push('/mistake-words')}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-2xl text-sm transition"
        >
          ← Back to Mistake Words
        </button>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Create the score page**

Create `app/(app)/mistake-words/retake/score/page.tsx`:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import MistakeRetakeScore from '@/components/mistake-words/MistakeRetakeScore'

interface RetakeWord {
  word_id: string
  english_word: string
}

interface RetakeResults {
  gotItWords: RetakeWord[]
  nopeWords: RetakeWord[]
}

export default function MistakeRetakeScorePage() {
  const router = useRouter()
  const [results, setResults] = useState<RetakeResults | null>(null)

  useEffect(() => {
    // sessionStorage is only available in the browser — must be inside useEffect
    const raw = sessionStorage.getItem('retake_results')
    if (!raw) {
      router.replace('/mistake-words')
      return
    }
    sessionStorage.removeItem('retake_results')
    try {
      setResults(JSON.parse(raw))
    } catch {
      router.replace('/mistake-words')
    }
  }, [router])

  // Render nothing during SSR or while reading sessionStorage
  if (!results) return null

  return <MistakeRetakeScore gotItWords={results.gotItWords} nopeWords={results.nopeWords} />
}
```

- [ ] **Step 3: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/mistake-words/retake/score/" components/mistake-words/MistakeRetakeScore.tsx
git commit -m "feat: retake score page — green/red chip breakdown + back button"
```

---

## Task 9: Final Check + Deploy

- [ ] **Step 1: Run full TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 2: Run full test suite**

```bash
npx jest --no-coverage
```

Expected: all tests pass, no regressions.

- [ ] **Step 3: Push to deploy**

```bash
git push
```

Expected: CI passes, Vercel deploys.

- [ ] **Step 4: Smoke test in browser**

1. Play a practice group — click "Nope" on at least 2 words
2. Visit Dashboard — "Mistake Words" card shows count > 0
3. Click the card → `/mistake-words` — list shows the words
4. Click "Retake (N)" → practice game loads
5. Click "Got it!" on one word and "Nope" on the rest → score screen appears
6. Score screen shows green chips (cleared) and red chips (remaining)
7. Click "← Back to Mistake Words" — count decreased by cleared words
