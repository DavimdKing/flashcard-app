# Flashcard UX Improvements Design

**Date:** 2026-03-31
**Status:** Approved
**Scope:** Three UX features — flip-back button, swipe gestures, admin nav collapse

---

## Feature 1: Flip-Back Button

### What
A small "↩ flip back" button on the **answer side** of every flashcard. Tapping it flips the card back to the question (front) side.

### Where
Top-left corner of the answer face inside `FlashCard.tsx`. Hidden when the card is showing the front.

### Behaviour
- Clicking the button sets the card back to its front state (unflipped).
- If the grade bar (`SelfGradeBar`) is currently visible, it hides — exactly as if the card had not yet been flipped.
- The grade bar reappears again (with the 500ms delay) the next time the user flips to the answer.

### Files affected
- `components/game/FlashCard.tsx` — add button to answer face; add `onFlipBack` callback prop
- `components/game/CardStack.tsx` — pass `onFlipBack` handler that calls `setShowGradeBar(false)`

---

## Feature 2: Swipe Gestures

### What
Touch (mobile) and mouse-drag (desktop) gestures on the flashcard, covering both the front and answer sides.

### Gesture Map

| Card side | Swipe left | Swipe right |
|-----------|-----------|-------------|
| Front (question) | Flip to answer | No action |
| Back (answer) | "Got it!" + next card | Flip back to question |

"Got it!" via swipe triggers the exact same code path as pressing the ✅ Got it button — progress is saved and the card advances. "Nope" has no swipe; the user must tap the button.

### Swipe Detection (custom, no library)

Implemented directly in `FlashCard.tsx` using pointer events or touch/mouse event pairs:

- **Touch:** `touchstart` records start X/Y; `touchend` computes delta.
- **Mouse:** `mousedown` records start X/Y; `mouseup` computes delta.
- **Threshold:** 50px horizontal delta required to register a swipe.
- **Directionality check:** `|deltaX| > |deltaY|` — gesture must be more horizontal than vertical to avoid conflicting with page scroll.
- **Scroll prevention:** `event.preventDefault()` called during horizontal tracking to prevent page scroll while swiping.
- **Debounce:** Swipes ignored while the existing `ignoreClicks` flag is active (same 500ms guard as taps).

### Swipe-to-grade flow
On a left-swipe from the answer side, `FlashCard` calls a new `onSwipeGotIt` callback. `CardStack` handles this identically to `handleGrade('got_it')`.

### Files affected
- `components/game/FlashCard.tsx` — add touch/mouse handlers; add `onSwipeGotIt` callback prop
- `components/game/CardStack.tsx` — pass `onSwipeGotIt` handler (delegates to `handleGrade('got_it')`)

---

## Feature 3: Admin Nav — Mobile Collapse

### What
On mobile screens, the admin sidebar collapses to an icon-only strip (48px wide). A hamburger button (☰) at the top toggles it open to full width (224px / `w-56`). On desktop the sidebar is always fully expanded — no change to current behaviour.

### Collapsed state (mobile default)
- Sidebar width: 48px
- Only icons visible; text labels hidden
- ☰ button at top of sidebar

### Expanded state (mobile, after tap)
- Sidebar width: 224px (`w-56`)
- Icons + labels visible, same as current desktop layout
- ✕ replaces ☰ button
- Tapping any nav link auto-collapses the sidebar

### Desktop
- Always expanded (`md:w-56`), hamburger button hidden (`md:hidden`)
- No behaviour change

### Animation
- CSS `transition: width 200ms ease` on the sidebar element for smooth collapse/expand

### Implementation
- Extract sidebar markup from `app/admin/layout.tsx` into a new **client component** `components/admin/AdminSidebar.tsx`
- Add `collapsed` boolean state (`useState(true)` — starts collapsed on mobile)
- `app/admin/layout.tsx` remains a server component; it imports and renders `<AdminSidebar>`
- Desktop breakpoint (`md:`) overrides collapsed state via CSS — sidebar always full-width on `md+` regardless of JS state

### Files affected
- `app/admin/layout.tsx` — remove inline sidebar markup, import `<AdminSidebar />`
- `components/admin/AdminSidebar.tsx` — new client component with toggle logic

---

## Out of Scope
- Swipe for "Nope" — intentionally excluded; user must tap the button
- Swipe right on the front side — no action (left-only on front)
- Admin nav collapse state persisted across page reloads (no localStorage)
- Gesture support in the score screens or dashboard cards
