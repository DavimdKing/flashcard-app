# Multiple Choice Practice — Design Spec

## Overview

Convert the practice and retake game modes from the existing self-graded flashcard mechanic (got_it / nope buttons) to a **4-option multiple choice** mechanic. The daily flashcard game is unaffected.

---

## Scope

- **Changed:** Practice play (`/practice/[id]`) and Mistake Words retake (`/mistake-words/retake`)
- **Unchanged:** Daily flashcard game (`/play`), CardStack, FlashCard, SelfGradeBar, all API routes

---

## Data & Types

Add `MultipleChoiceWord` to `lib/types.ts`:

```ts
export interface MultipleChoiceWord {
  word_id: string
  english_word: string
  thai_translation: string       // the correct answer
  part_of_speech: string | null
  image_url: string | null
  audio_url: string | null
  english_example: string | null
  thai_example: string | null
  choices: string[]              // 4 Thai strings, pre-shuffled; correct answer is among them
}
```

### Distractor loading (server-side)

Distractors are fetched **at page load** in the server component — no new API endpoint, no per-card loading.

**Two steps in each server page:**

**Step 1 — fetch pool (in the server component, after fetching session words):**
```ts
const sessionWordIds = sessionWords.map(w => w.word_id)  // sessionWords.length is the session size
const { data: poolRows } = await service
  .from('words')
  .select('thai_translation')
  .not('id', 'in', `(${sessionWordIds.join(',')})`)
  .eq('is_deleted', false)
  .order('id', { ascending: false })   // deterministic enough; actual randomness provided by Fisher-Yates below
  .limit(sessionWordIds.length * 4)    // session_size * 4 to provide slack

const pool: string[] = (poolRows ?? []).map(r => r.thai_translation)

if (pool.length === 0) redirect('/practice')  // or redirect('/mistake-words') for retake
```

**Step 2 — build choices (pure sync helper `lib/distractors.ts`):**
```ts
// Returns null if pool is empty (caller has already redirected, so this is a safety net only)
function buildMultipleChoiceWords(
  sessionWords: Array<{ word_id: string; english_word: string; thai_translation: string; part_of_speech: string | null; image_url: string | null; audio_url: string | null; english_example: string | null; thai_example: string | null }>,
  pool: string[]
): MultipleChoiceWord[]
```

The input `sessionWords` array matches the shape already assembled in each server page (practice group words and mistake words both produce the same fields). No new shared type needed — the function's parameter type is structural and both callers satisfy it.

**Distractor selection algorithm (inside `buildMultipleChoiceWords`):**

For each word in `sessionWords`:
1. Filter pool to entries whose string ≠ `word.thai_translation`. Call this `candidates`.
2. If `candidates` is empty (all pool entries match this word's translation — degenerate data), fall back to the full pool and pick 3. The correct answer may appear twice; acceptable last resort.
3. Pick 3 entries from `candidates`, allowing repeats across different cards; prefer distinct within this word's 3 slots. If `candidates.length < 3`, use repeats.
4. Shuffle the 4 choices (correct + 3 distractors) with Fisher-Yates.
5. Return `{ ...word, choices }`.

---

## Components

### `components/game/MultipleChoiceCard.tsx` *(new)*

Client component. Renders one multiple-choice card with a 3D flip animation identical to FlashCard.

**Props:**
```ts
interface Props {
  word: MultipleChoiceWord
  bgGradient: string
  onSubmit: (correct: boolean) => void   // called once per card after Submit is tapped
  onSwipeNext: () => void                // called when user swipes left from the back face
}
```

**Front face:**
- Audio button (top-left)
- English word (centre, large)
- 4 Thai choice buttons — tapping one highlights it (white background, purple text); tapping another switches selection
- Submit button — grey/disabled until a choice is tapped; purple/active once selected
- Tapping Submit: locks choices (no re-selection), flips card to back, calls `onSubmit(selectedChoice === word.thai_translation)`
- Swipe right on the front face: no-op (card stays on front — same as FlashCard behaviour)

**Back face (revealed after Submit):**
- Result badge at top: green "✅ Correct!" or yellow "❌ Wrong — correct: [thai_translation]"
- Thai translation (large)
- Part of speech
- Image (if available)
- English example + Thai example
- ↩ flip button (top-right) — flips back to front
- Swipe left → calls `onSwipeNext()` (advance to next card)
- Swipe right → flips back to front (same as ↩ flip button)

**Flip-back behaviour:** when the user flips back to the front face after submitting, the previously-selected choice remains visually highlighted (selection state is preserved in component state — not reset on flip-back, only on card advance via `key`). Submit remains disabled. The result badge reappears on the next flip to the back face.

**Flip-lock:** card cannot be flipped to back by tap or swipe until Submit has been pressed.

---

### `components/game/MultipleChoiceStack.tsx` *(new)*

Client component. Orchestrates the multiple-choice session.

**No asset preloading phase** — renders immediately. No `GameLoadingScreen` at start.

**No mid-session resume** — always starts from index 0. Page refresh restarts.

**Props (discriminated union — compile-time safe):**
```ts
type Props =
  | {
      words: MultipleChoiceWord[]
      mode: 'practice'
      onSessionComplete: (scorePct: number) => void
      onRetakeComplete?: never
    }
  | {
      words: MultipleChoiceWord[]
      mode: 'retake'
      onRetakeComplete: (gotItWordIds: string[], nopeWordIds: string[]) => void
      onSessionComplete?: never
    }
```

**Behaviour:**
- Renders progress bar (`currentIdx / total`) — same styling as CardStack
- Renders `<MultipleChoiceCard key={words[currentIdx].word_id} ... />` — `key` forces a fresh instance on each card advance (resets flip state for the new card; does not affect the previous card's recorded result)
- `onSubmit(correct)` handler:
  - Records result into `results` state: `correct → 'got_it'`, `!correct → 'nope'`
  - `practice` mode + wrong → fire-and-forget POST `/api/mistake-words` `{ word_id }`
  - `retake` mode + correct → fire-and-forget DELETE `/api/mistake-words/[word_id]`
  - Does **not** advance the card — user must swipe left from the back face
- `onSwipeNext()` handler: calls `setCurrentIdx(i => i + 1)`
- Session completion uses `useEffect` watching `[currentIdx, results]` with `completedRef` — identical pattern to `CardStack`. `onSubmit` and `onSwipeNext` are separate user gestures, so React 18 automatic batching commits `results` before `currentIdx` advances; the effect sees the complete results array. `completedRef` is the safety net if batching behaviour changes.
- `score_pct = Math.round(gotItCount / total * 100)` — e.g. 3 correct / 7 total → 43
- Shows `<GameLoadingScreen />` only after all cards are done while the completion callback processes

---

## Modified Files

### `components/practice/PracticePlay.tsx`

- Change prop: remove `practiceSet: DailySetResponse` → accept `words: MultipleChoiceWord[]`. Keep `groupId`.
- Swap `<CardStack initialSet={practiceSet} initialProgress={[]} mode="practice" onSessionComplete={...} />` → `<MultipleChoiceStack words={words} mode="practice" onSessionComplete={handleSessionComplete} />`
- `handleSessionComplete` logic unchanged

### `components/mistake-words/MistakeRetakePlay.tsx`

- Change prop: `words: MistakeWord[]` → `words: MultipleChoiceWord[]`
- Remove the `retakeSet: DailySetResponse` construction — no longer needed
- Swap `<CardStack initialSet={retakeSet} initialProgress={[]} mode="retake" onRetakeComplete={...} />` → `<MultipleChoiceStack words={words} mode="retake" onRetakeComplete={handleRetakeComplete} />`
- `handleRetakeComplete` is unchanged: it closes over `words` and calls `words.find(x => x.word_id === id)!` to build `RetakeWord = { word_id, english_word }`. `MultipleChoiceWord` has both fields, so the existing `RetakeWord` interface and `toWord` helper need no modification.

### `app/(app)/practice/[id]/page.tsx`

After fetching group words: fetch distractor pool, call `buildMultipleChoiceWords`, redirect to `/practice` if pool is empty. Pass `MultipleChoiceWord[]` to `PracticePlay`.

### `app/(app)/mistake-words/retake/page.tsx`

After fetching mistake words: fetch distractor pool, call `buildMultipleChoiceWords`, redirect to `/mistake-words` if pool is empty. Pass `MultipleChoiceWord[]` to `MistakeRetakePlay`.

---

## Scoring

| User action | Result | Mistake Words | Score |
|---|---|---|---|
| Correct answer — practice | `got_it` | No change | +1 |
| Wrong answer — practice | `nope` | Word added (upsert, fire-and-forget) | +0 |
| Correct answer — retake | `got_it` | Word removed (fire-and-forget) | +1 |
| Wrong answer — retake | `nope` | Word stays | +0 |

- `score_pct = Math.round(got_it_count / total * 100)` — unchanged formula
- Practice best score saved via existing POST `/api/practice/sessions` — unchanged
- Retake score screen — unchanged

---

## Error Handling

- **Zero pool:** server component redirects before calling `buildMultipleChoiceWords`. Only possible when entire database is within the session.
- **Insufficient unique distractors per word:** pad with repeats. Card always shows exactly 4 choices.
- **All pool entries match word's own translation:** fall back to unfiltered pool. Correct answer may appear twice — degenerate data only.
- **Mistake word API failures:** fire-and-forget, logged to console. DELETEs may be in-flight when score page loads — matches existing CardStack retake behaviour.

---

## Testing

- **`MultipleChoiceCard`:**
  - Renders exactly 4 choices
  - Submit disabled until a choice is tapped; active after selection
  - `onSubmit(true)` for correct choice; `onSubmit(false)` for wrong
  - Correct/wrong result badge shown after submit
  - Swipe right on front face is a no-op
  - ↩ flip button and swipe right from back face return to front; previously-selected choice remains highlighted; Submit stays disabled
  - Swipe left from back face calls `onSwipeNext`

- **`MultipleChoiceStack`:**
  - Progress bar advances on `onSwipeNext`
  - `onSessionComplete(43)` for 3 correct / 7 total (`Math.round(3/7*100)`)
  - Mistake word POST fired on wrong answer in practice mode; not fired on correct
  - DELETE fired on correct answer in retake mode; not fired on wrong
  - `completedRef` prevents double-firing

- **`lib/distractors.ts`:**
  - Exactly 4 choices per word; correct answer always present
  - Choices shuffled — correct position varies
  - No distractor equals the word's own `thai_translation` (when non-matching candidates exist)
  - Small-pool: fewer than 3 candidates → 4 choices returned with repeats as padding
  - Degenerate: all pool entries match word's translation → still returns 4 choices using unfiltered pool

- **Server components (`practice/[id]/page.tsx`, `mistake-words/retake/page.tsx`):**
  - Calls `redirect('/practice')` (or `/mistake-words`) when pool query returns 0 rows
  - Passes correctly shaped `MultipleChoiceWord[]` to client component when pool is non-empty
