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

**Algorithm (runs in `app/(app)/practice/[id]/page.tsx` and `app/(app)/mistake-words/retake/page.tsx`):**

1. Collect the `word_id`s of all words in the session (group words or mistake words).
2. Query Supabase: fetch `thai_translation` from `words` WHERE `id NOT IN (session word ids)` AND `is_deleted = false` ORDER BY `RANDOM()` LIMIT `session_size * 3` (ensures enough unique distractors).
3. For each word in the session, pick 3 distractors from the pool (non-overlapping across the word's own 3 slots — distractors may repeat across different words).
4. Shuffle the 4 choices (correct + 3 distractors) with Fisher-Yates.
5. Pass the enriched list as `MultipleChoiceWord[]` to the client component.

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

**Back face (revealed after Submit):**
- Result badge at top: green "✅ Correct!" or yellow "❌ Wrong — correct: [thai_translation]"
- Thai translation (large)
- Part of speech
- Image (if available)
- English example + Thai example
- ↩ flip button (top-right) — flips back to front (re-reads the question; Submit is disabled on revisit, result badge persists)
- Swipe left → calls `onSwipeNext()` (advance to next card)
- Swipe right → flips back to front (same as ↩ flip button)

**Flip-lock:** card cannot be flipped to back by tap/swipe until Submit has been pressed. This enforces the rule that the user must answer before seeing the answer.

---

### `components/game/MultipleChoiceStack.tsx` *(new)*

Client component. Orchestrates the multiple-choice session — mirrors `CardStack`'s structure but uses `MultipleChoiceCard`.

**Props:**
```ts
interface Props {
  words: MultipleChoiceWord[]
  mode: 'practice' | 'retake'
  onSessionComplete?: (scorePct: number) => void
  onRetakeComplete?: (gotItWordIds: string[], nopeWordIds: string[]) => void
}
```

**Behaviour:**
- Renders progress bar (`currentIdx / total`) — same styling as CardStack
- Renders `MultipleChoiceCard` for `words[currentIdx]`
- `onSubmit(correct)` handler:
  - Records result: `correct → 'got_it'`, `!correct → 'nope'`
  - `practice` mode + wrong → fire-and-forget POST `/api/mistake-words` `{ word_id }`
  - `retake` mode + correct → fire-and-forget DELETE `/api/mistake-words/[word_id]`
  - Does **not** advance the card — user must swipe left from the back face
- `onSwipeNext()` handler: advances `currentIdx`; when `currentIdx >= total` → calls `onSessionComplete` or `onRetakeComplete` with accumulated results
- Uses `completedRef` to prevent double-firing (same pattern as CardStack)
- No `SelfGradeBar` used
- Shows `<GameLoadingScreen />` while `onSessionComplete` / `onRetakeComplete` is processing (same as CardStack practice/retake behaviour)

---

## Modified Files

### `components/practice/PracticePlay.tsx`

Swap `CardStack` → `MultipleChoiceStack`. Props change:
- Remove `initialSet: DailySetResponse` → accept `words: MultipleChoiceWord[]`
- Keep `groupId` for the sessions API call
- `onSessionComplete` logic unchanged (POST `/api/practice/sessions`, redirect to score page)

### `components/mistake-words/MistakeRetakePlay.tsx`

Swap `CardStack` → `MultipleChoiceStack`. Accept `words: MultipleChoiceWord[]` instead of `MistakeWord[]`.

### `app/(app)/practice/[id]/page.tsx`

After fetching group words, run the distractor algorithm (see above) and pass `MultipleChoiceWord[]` to `PracticePlay`.

### `app/(app)/mistake-words/retake/page.tsx`

After fetching mistake words, run the distractor algorithm and pass `MultipleChoiceWord[]` to `MistakeRetakePlay`.

---

## Scoring

| User action | Result | Mistake Words | Score |
|---|---|---|---|
| Correct answer — practice | `got_it` | No change | +1 |
| Wrong answer — practice | `nope` | Word added (upsert, fire-and-forget) | +0 |
| Correct answer — retake | `got_it` | Word removed (fire-and-forget) | +1 |
| Wrong answer — retake | `nope` | Word stays | +0 |

- `score_pct = round(got_it_count / total * 100)` — unchanged formula
- Practice best score saved via existing POST `/api/practice/sessions` — unchanged
- Retake score screen — unchanged

---

## Error Handling

- If distractor query returns fewer than `session_size * 3` words (small database): assign however many are available; if a word has fewer than 3 unique distractors, repeat from the pool. Minimum viable: 1 correct + available distractors (pad with repeats only as last resort).
- Mistake word API calls (POST/DELETE) are fire-and-forget — failures logged to console, never block UI.

---

## Testing

- `MultipleChoiceCard` — unit tests: renders 4 choices, Submit disabled until selection, Submit calls onSubmit with correct boolean, correct/wrong badge shown after submit, flip-back and swipe gestures
- `MultipleChoiceStack` — unit tests: advances on swipeNext, calls onSessionComplete with correct score, mistake word fetch fired on wrong answer in practice mode, delete fired on correct answer in retake mode
- Distractor algorithm — unit tests: exactly 4 choices per word, correct answer always present, choices shuffled (not always in same position)
