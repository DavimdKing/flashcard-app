# Mistake Words — Design Spec
**Date:** 2026-03-28
**Status:** Approved

---

## Overview

When a user clicks "Nope" on any card during a **practice session**, that word is recorded to a per-user mistake list. From the dashboard the user can open the Mistake Words page to review all recorded words and optionally retake them. Pressing "Got it!" during a retake removes the word from the list permanently. The feature applies to practice mode only — not the daily flashcard game.

---

## 1. Database

### New table: `mistake_words`

```sql
CREATE TABLE mistake_words (
  user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  word_id  uuid NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, word_id)
);
```

- Primary key on `(user_id, word_id)` enforces uniqueness — inserting the same word twice is a no-op (ON CONFLICT DO NOTHING).
- `ON DELETE CASCADE` on both FKs: deleting a user or a word cleans up automatically.

### RLS policies

```sql
ALTER TABLE mistake_words ENABLE ROW LEVEL SECURITY;

-- Users read their own rows only
CREATE POLICY "Users read own mistake words"
  ON mistake_words FOR SELECT
  USING (user_id = auth.uid());

-- Users insert their own rows only
CREATE POLICY "Users insert own mistake words"
  ON mistake_words FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users delete their own rows only
CREATE POLICY "Users delete own mistake words"
  ON mistake_words FOR DELETE
  USING (user_id = auth.uid());
```

---

## 2. API Routes

### `GET /api/mistake-words`
Returns all mistake words for the authenticated user with full word data.

**Auth:** 401 if unauthenticated, 403 if `is_approved = false`.

**Response:**
```json
[
  {
    "word_id": "uuid",
    "english_word": "eloquent",
    "part_of_speech": "adj",
    "thai_translation": "พูดจาไพเราะ, มีวาทศิลป์",
    "english_example": "She gave an eloquent speech.",
    "thai_example": "เธอกล่าวสุนทรพจน์ได้อย่างไพเราะ",
    "created_at": "2026-03-28T10:00:00Z"
  }
]
```

**Implementation:** Direct Supabase query via `createClient()` (anon client, RLS-scoped to the user). JOIN `mistake_words` → `words` filtering `words.is_deleted = false`, ordered by `mistake_words.created_at DESC`. `image_url` and `audio_url` are intentionally excluded from this response — the list page does not need them. The retake play path sources word data from its own server component query which includes all fields needed by `CardStack`.

---

### `POST /api/mistake-words`
Adds a word to the user's mistake list. Idempotent — duplicate inserts are silently ignored.

**Auth:** 401/403.

**Body:** `{ "word_id": "uuid" }`

**Validation:** UUID regex on `word_id`; verify word exists and `is_deleted = false` → 404.

**Response:** `{ "ok": true }`

---

### `DELETE /api/mistake-words/[word_id]`
Removes a word from the user's mistake list (called when "Got it!" is pressed during retake).

**Auth:** 401/403.

**Next.js 16 params:** `export async function DELETE(_req: Request, { params }: { params: Promise<{ word_id: string }> })` — `await params` before accessing `params.word_id`.

**Response:** `{ "ok": true }` (204-style; no error if word wasn't in list — idempotent).

---

## 3. CardStack Changes

Add `mode = 'retake'` to the existing `'daily' | 'practice'` union. The `mode` prop default (`'daily'`) is unchanged.

Add callback:
```ts
onRetakeComplete?: (gotItWordIds: string[], nopeWordIds: string[]) => void
```

### Behaviour in retake mode

- Skip `/api/progress` calls — retake mode behaves identically to practice mode for API calls (neither calls `/api/progress`).
- `onSessionComplete` is **NOT** called in retake mode — only `onRetakeComplete` is called. The implementer must add `mode === 'retake'` guards wherever `onSessionComplete` is fired.
- On **"Got it!"**: fire `DELETE /api/mistake-words/[word_id]` immediately (non-blocking, log errors to console). Do not wait for response before advancing the card.
- On **"Nope"**: no API call — word stays in mistake list.
- `completedRef` guard (already present) prevents duplicate callbacks.
- When `currentIdx >= total`: call `onRetakeComplete(gotItIds, nopeIds)` and render `<GameLoadingScreen />` while parent navigates.

---

## 4. Practice Mode Change — Recording "Nope"

In `CardStack`, when `mode === 'practice'` and the grade is `'nope'`:
- Fire `POST /api/mistake-words` with `{ word_id }` (non-blocking, log errors to console).
- Do not block card advancement.

> **Only practice mode.** Daily mode (`mode === 'daily'`) continues to use `/api/progress` unchanged.

---

## 5. Dashboard Card

Replace `<StatCard placeholder />` in `app/(app)/dashboard/page.tsx` with a new `<MistakeWordsCard count={N} />` server component.

`MistakeWordsCard` fetches the mistake word count server-side via a direct Supabase query using `createClient()` from `lib/supabase/server` (anon client, RLS enforced — count is automatically scoped to the authenticated user). It renders as a clickable card linking to `/mistake-words`.

**States:**
- **count > 0:** orange accent bar, count prominently displayed, "words to review →" subtext.
- **count = 0:** muted style, "0 · all clear ✓" message.

---

## 6. Pages & Components

### `app/(app)/mistake-words/page.tsx` (server component)
- Auth + `is_approved` guard.
- Fetches mistake words via a direct Supabase query using `createClient()` (do NOT fetch `/api/mistake-words` from a server component — adds unnecessary round-trip with no benefit).
- Passes data to `MistakeWordsClient`.

### `components/mistake-words/MistakeWordsClient.tsx` (client component)
- Renders word list: english word, POS badge, Thai meaning, italic example sentences.
- **Retake button** at top:
  - Label: `Retake (N)` where N = `Math.min(words.length, 20)`.
  - **Disabled + grey** when `words.length < 2`.
  - Links to `/mistake-words/retake`.

### `app/(app)/mistake-words/retake/page.tsx` (server component)
- Auth + `is_approved` guard.
- Fetches mistake words (same query).
- If fewer than 2 words → redirect to `/mistake-words`.
- Fisher-Yates shuffle; slice to first 20.
- Renders `<MistakeRetakePlay words={shuffledWords} />`.

### `components/mistake-words/MistakeRetakePlay.tsx` (client component)
- Builds a `DailySetResponse`-shaped object with dummy `set_id`/`set_date`.
- Renders `<CardStack mode="retake" onRetakeComplete={handleComplete} ... />`.
- `handleComplete(gotItIds, nopeIds)`: stores results in `sessionStorage` (key `retake_results`), then `router.push('/mistake-words/retake/score')`.

### `app/(app)/mistake-words/retake/score/page.tsx` (client component — needs sessionStorage)
- Must be a `'use client'` component.
- Reads `retake_results` from `sessionStorage` inside a `useEffect` (never access `sessionStorage` outside `useEffect` — it is unavailable during SSR and will cause a hydration error).
- If data is missing → `router.replace('/mistake-words')`.
- Clears `sessionStorage` key after reading.
- Renders `MistakeRetakeScore`.

### `components/mistake-words/MistakeRetakeScore.tsx` (client component)
- Shows `X / Y` score (gotIt count / total).
- Green chip list for "Got it!" words (cleared).
- Red chip list for "Nope" words (still in list).
- "← Back to Mistake Words" button → `router.push('/mistake-words')`.

---

## 7. Screen Flow

```
Dashboard card (count)
  └─► /mistake-words         (MistakeWordsClient — list + Retake button)
         └─► /mistake-words/retake     (MistakeRetakePlay — CardStack mode=retake)
                └─► /mistake-words/retake/score  (MistakeRetakeScore — results)
                       └─► /mistake-words        (← Back button)
```

---

## 8. Edge Cases

| Case | Behaviour |
|------|-----------|
| User nopes same word in multiple practice sessions | `ON CONFLICT DO NOTHING` — one entry per word |
| User presses "Got it!" in retake but it was already removed | DELETE is idempotent — no error |
| words.length < 2 on retake page load | Redirect to `/mistake-words` server-side |
| Word deleted from `words` table by admin | Cascade deletes from `mistake_words` automatically |
| Retake score page loaded without session data | Redirect to `/mistake-words` |
| Practice word count is exactly 0 | Dashboard shows "0 · all clear ✓" in muted style |

---

## 9. Files Changed / Created

| File | Change |
|------|--------|
| `supabase/migrations/006_mistake_words.sql` | New migration |
| `lib/types.ts` | Add `MistakeWord` interface |
| `components/game/CardStack.tsx` | Add `mode='retake'`, `onRetakeComplete`, nope-recording for practice mode |
| `app/api/mistake-words/route.ts` | GET + POST |
| `app/api/mistake-words/[word_id]/route.ts` | DELETE |
| `app/(app)/dashboard/page.tsx` | Replace `<StatCard placeholder />` |
| `components/dashboard/MistakeWordsCard.tsx` | New |
| `app/(app)/mistake-words/page.tsx` | New |
| `components/mistake-words/MistakeWordsClient.tsx` | New |
| `app/(app)/mistake-words/retake/page.tsx` | New |
| `components/mistake-words/MistakeRetakePlay.tsx` | New |
| `app/(app)/mistake-words/retake/score/page.tsx` | New |
| `components/mistake-words/MistakeRetakeScore.tsx` | New |
