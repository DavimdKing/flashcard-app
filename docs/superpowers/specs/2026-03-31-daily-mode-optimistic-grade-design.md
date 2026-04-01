# Daily Mode Optimistic Grade Save Design

**Date:** 2026-03-31
**Status:** Approved
**Scope:** Remove blocking API await in daily mode card grading to eliminate 0.5–1s swipe delay

---

## Problem

In the flashcard daily game, swiping or clicking "Got it!" to advance to the next card has a noticeable 0.5–1 second freeze. Practice and retake modes feel instant.

**Root cause:** `CardStack.tsx` `handleGrade()` uses `await fetch('/api/progress', ...)` in daily mode. The UI does not advance until the API responds. The `/api/progress` POST runs 4 database queries (auth, user approval, set validation, progress upsert), adding 500–1000ms of latency on every card.

Practice and retake modes fire their fetch calls without `await` (fire-and-forget), so the UI advances immediately.

---

## Solution — Optimistic Update (Option A)

Make daily mode's progress save fire-and-forget, exactly matching the pattern already used by practice and retake modes.

### What changes

**File:** `components/game/CardStack.tsx` — `handleGrade()` function only.

**Before:**
```typescript
if (mode === 'daily') setSaving(true)

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
  } finally {
    setSaving(false)
  }
}
```

**After:**
```typescript
if (mode === 'daily') {
  fetch('/api/progress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ set_id, word_id: currentWord.word_id, result }),
  }).catch(err => console.error('[CardStack] Failed to save grade:', err))
}
```

### Cascade effects

- `setSaving(true)` and `setSaving(false)` are removed — `saving` state always stays `false`
- `SelfGradeBar disabled={saving}` is always `false` — buttons are never disabled
- `saving` state declaration and `useState(false)` remain but are effectively dead code — remove them for cleanliness along with the `disabled={saving}` prop on `SelfGradeBar`
- `handleGrade` no longer needs to be `async` since there is no `await` in the function body — change to a regular function

### Double-grade safety

No new double-grade risk is introduced:
- Card advances instantly via `setCurrentIdx(i => i + 1)` — the grade bar disappears before the user can tap again
- Swipe path: `ignoreClicks` debounce in `FlashCard` prevents rapid re-trigger
- Button path: grade bar unmounts immediately on advance

### Failure behaviour

If the network save fails (e.g. no internet):
- The error is logged to the console
- The card has already advanced — the grade is silently lost
- Accepted trade-off: data loss on network failure is rare and preferable to a 0.5–1s freeze on every card in every session

---

## Out of Scope

- Retry queue or offline storage for failed saves
- API optimisation (reducing the number of DB queries in `/api/progress`)
- Any changes to practice or retake modes (already optimistic)
- Any UI changes (no toast, no error indicator)
