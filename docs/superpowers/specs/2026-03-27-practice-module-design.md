# Practice Module — Design Spec
**Date:** 2026-03-27
**Status:** Approved

---

## Overview

A new Practice module that lets users play flashcard sessions against curated vocabulary groups. Groups are created and managed by admins, who pick exactly 20 words from the existing `words` table. Each time a user enters a group the cards are shuffled. Sessions are scored using the same got_it / nope mechanics as the daily flashcard game. Best scores are tracked and surfaced on the Dashboard.

---

## Screen Flow

```
Nav (📚 Practice)
  → /practice          Practice Hub (grid ↔ list toggle)
    → /practice/[id]   Play group (shuffled CardStack)
      → Score screen   Current score + personal best + Play Again / Back to Hub
```

The Practice nav item is added as the 4th entry in `NAV_ITEMS` in `components/app/AppNav.tsx`:
```ts
{ label: 'Practice', href: '/practice', icon: '📚', mobileLabel: 'Practice' }
```

---

## Database Schema (3 new tables)

### `practice_groups`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | default gen_random_uuid() |
| `name` | text NOT NULL | e.g. "Food & Drinks" |
| `icon` | text NOT NULL | single emoji, e.g. "🍎" |
| `is_active` | boolean NOT NULL DEFAULT false | false = Draft, true = Active (visible to users) |
| `created_at` | timestamptz NOT NULL DEFAULT now() | |

### `practice_group_words`
| Column | Type | Notes |
|---|---|---|
| `group_id` | uuid FK → practice_groups.id ON DELETE CASCADE | |
| `word_id` | uuid FK → words.id ON DELETE CASCADE | |
| `position` | int NOT NULL | 1–20, determines default order before shuffle |
| PRIMARY KEY | (group_id, word_id) | |

### `practice_sessions`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | default gen_random_uuid() |
| `user_id` | uuid FK → auth.users.id ON DELETE CASCADE | |
| `group_id` | uuid FK → practice_groups.id ON DELETE CASCADE | |
| `score_pct` | int NOT NULL | 0–100, percentage of got_it answers |
| `played_at` | timestamptz NOT NULL DEFAULT now() | |

**Best score query:**
```sql
SELECT MAX(score_pct)
FROM practice_sessions
WHERE user_id = $1 AND group_id = $2;
```

**RLS policies:**
- `practice_groups`: public read for `is_active = true`; service role full access
- `practice_group_words`: public read (joined via active groups); service role full access
- `practice_sessions`: users read/insert their own rows (`user_id = auth.uid()`)

---

## Practice Hub (`/practice`)

Server component. Fetches all active groups via service client. For the signed-in user, fetches their best score per group from `practice_sessions`.

### Grid View (default)
- 2-column grid of colour-coded cards
- Each card: emoji (large), group name (bold), "20 words" label
- Card background colour cycles through a fixed palette (same warm pastel approach as CardStack gradients)
- Tapping a card navigates to `/practice/[id]`

### List View
- Single-column scrollable list
- Each row: emoji in a tinted circle, group name, horizontal progress bar (best score %), score % label
- Progress bar colour: green ≥70%, amber ≥40%, red <40%; dash if never played
- Tapping a row navigates to `/practice/[id]`

### Toggle Button
- Positioned top-right of the page header
- Shows "☰ List" when in grid view, "⊞ Grid" when in list view
- Active view highlighted (purple button vs grey outline)
- Preference persisted to `localStorage` key `practice-view` so it survives page reloads

---

## Practice Game (`/practice/[id]`)

Server component loads the group's 20 words (joined from `practice_group_words` + `words`). Words are **shuffled** server-side using Fisher-Yates before being passed to the client component.

Reuses the existing `CardStack` component in **practice mode**:
- Same got_it / nope mechanics and card UI
- No `user_progress` rows written (practice does not affect daily progress)
- On completion, POSTs to `/api/practice/sessions` with `{ group_id, score_pct }`
- After save, navigates to the score screen

---

## Score Screen (end of practice session)

Displayed after completing all 20 cards. Shows:
- Group emoji + name
- Current session score (large, colour-coded)
- Personal best for this group (fetched from `practice_sessions`)
- Two buttons: **Play Again** (re-enters `/practice/[id]`, re-shuffles) and **Back to Practice** (→ `/practice`)

---

## API Routes

### `GET /api/practice/groups`
Returns all active groups with word count and the requesting user's best score per group.

```ts
// Response
[{ id, name, icon, word_count: number, best_score: number | null }]
```

### `GET /api/practice/groups/[id]/words`
Returns the 20 words for a group (used by the play page server component — not a client fetch).

### `POST /api/practice/sessions`
Saves a completed session. Body: `{ group_id: string, score_pct: number }`. Validates score_pct is 0–100 integer. Returns `{ id, score_pct, best_score }` where `best_score` is the new personal best (or previous if unchanged).

---

## Admin — Practice Groups (`/admin/practice-groups`)

New section added to admin nav with label "Practice Groups".

### List page (`/admin/practice-groups`)
- Table of all groups (both active and draft)
- Columns: icon, name, word count, status badge (Active = green, Draft = grey), Edit button
- "+ New Group" button top-right → `/admin/practice-groups/new`

### New / Edit page (`/admin/practice-groups/new` and `/admin/practice-groups/[id]`)
Fields:
- **Name** — text input
- **Icon** — text input (admin types an emoji directly)
- **Status** — Active / Draft toggle (group cannot be set Active if fewer than 20 words are selected; UI shows word count as "12/20" and disables Active toggle until 20 reached)
- **Word picker** — search box that queries existing `words` table by `english_word` (case-insensitive ILIKE). Results shown as a dropdown list. Selected words rendered as removable chips. Maximum 20 words enforced.

Save button: upserts to `practice_groups` + replaces all rows in `practice_group_words` for that group.
Delete button: hard-deletes the group (cascades to `practice_group_words`; `practice_sessions` rows are kept for historical record via SET NULL or kept as-is — group_id becomes orphaned but data is preserved).

---

## Dashboard Changes

The existing daily flashcard score chart and Play CTA remain unchanged.

A new **"PRACTICE — BEST SCORES"** section is added below the Play CTA:
- Horizontally scrollable row of mini group columns
- Each column: emoji (top), short group name (truncated to ~8 chars), mini horizontal progress bar, score % (or dash)
- Bar colour follows same rules: green ≥70%, amber ≥40%, red <40%
- Only active groups shown
- Groups with no sessions show a dash and an empty grey bar
- Tapping a group column navigates to `/practice/[id]`

New RPC function for dashboard data:
```sql
CREATE OR REPLACE FUNCTION get_user_practice_best_scores(p_user_id uuid)
RETURNS TABLE(group_id uuid, best_score int)
LANGUAGE sql STABLE AS $$
  SELECT group_id, MAX(score_pct)::int AS best_score
  FROM practice_sessions
  WHERE user_id = p_user_id
  GROUP BY group_id;
$$;
```

---

## Component Map

| Component | Path | Notes |
|---|---|---|
| `PracticeHub` | `app/(app)/practice/page.tsx` | Server component, fetches groups + best scores |
| `PracticeGroupGrid` | `components/practice/PracticeGroupGrid.tsx` | Client, renders grid view + toggle |
| `PracticeGroupList` | `components/practice/PracticeGroupList.tsx` | Client, renders list view |
| `PracticePlay` | `app/(app)/practice/[id]/page.tsx` | Server component, shuffles words, renders CardStack |
| `PracticeScoreScreen` | `components/practice/PracticeScoreScreen.tsx` | Client, shows score + best + actions |
| `PracticeBestScores` | `components/dashboard/PracticeBestScores.tsx` | Client, horizontal scroll row for dashboard |
| Admin list | `app/admin/practice-groups/page.tsx` | Server component |
| Admin form | `app/admin/practice-groups/[id]/page.tsx` | Client component |
| `WordPicker` | `components/admin/WordPicker.tsx` | Reusable search + chip selector |

---

## Migration File

`supabase/migrations/005_practice_module.sql`

Creates: `practice_groups`, `practice_group_words`, `practice_sessions` tables, all RLS policies, and the `get_user_practice_best_scores` RPC function.

---

## Out of Scope

- Word-level tracking within practice sessions (which words the user got wrong)
- Practice scores feeding into the daily streak or gamification
- Reordering groups by drag-and-drop in admin
- User-created custom groups
