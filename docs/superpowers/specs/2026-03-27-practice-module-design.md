# Practice Module — Design Spec
**Date:** 2026-03-27
**Status:** Approved

---

## Overview

A new Practice module that lets users play flashcard sessions against curated vocabulary groups. Groups are created and managed by admins, who pick exactly 20 words from the existing `words` table. Each time a user enters a group the cards are shuffled. Sessions are scored using the same got_it / nope mechanics as the daily flashcard game. Best scores are tracked and surfaced on the Dashboard.

---

## Score Colour Thresholds (canonical)

All score displays use the existing `scoreColor()` function from `lib/score-color.ts`. Do not re-implement the logic:

```ts
// lib/score-color.ts (existing)
if (pct >= 90) return 'bg-green-600'   // dark green
if (pct >= 70) return 'bg-green-300'   // light green
if (pct >= 40) return 'bg-amber-400'   // amber
return 'bg-red-500'                    // red
// not played → grey dash (no scoreColor call)
```

---

## Score Calculation

`score_pct = ROUND(got_it_count / 20.0 * 100)::int`

With 20 cards, valid values are multiples of 5 (0, 5, 10, … 100). Stored as `int`.

---

## Screen Flow

```
Nav (📚 Practice)
  → /practice                  Practice Hub (grid ↔ list toggle)
    → /practice/[id]           Play group (shuffled CardStack)
      → /practice/[id]/score   Score screen (current score + personal best)
        → Play Again           → /practice/[id]  (full navigation, new server render, new shuffle)
        → Back to Practice     → /practice
```

The Practice nav item is the 4th entry in `NAV_ITEMS` in `components/app/AppNav.tsx`:
```ts
{ label: 'Practice', href: '/practice', icon: '📚', mobileLabel: 'Practice' }
```

`isActive` already uses prefix matching so `/practice`, `/practice/abc`, and `/practice/abc/score` all highlight the Practice tab.

---

## Database Schema (3 new tables)

### `practice_groups`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | `DEFAULT gen_random_uuid()` |
| `name` | text NOT NULL | e.g. "Food & Drinks" |
| `icon` | text NOT NULL | single emoji, e.g. "🍎" |
| `is_active` | boolean NOT NULL DEFAULT false | false = Draft; true = Active (visible to users) |
| `created_at` | timestamptz NOT NULL DEFAULT now() | |

### `practice_group_words`
| Column | Type | Notes |
|---|---|---|
| `group_id` | uuid FK → practice_groups.id ON DELETE CASCADE | |
| `word_id` | uuid FK → words.id ON DELETE CASCADE | |
| `position` | int NOT NULL CHECK (position BETWEEN 1 AND 20) | Used for stable display order in admin word chip list; ignored during gameplay (shuffle overrides) |
| PRIMARY KEY | (group_id, word_id) | |

### `practice_sessions`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | `DEFAULT gen_random_uuid()` |
| `user_id` | uuid FK → auth.users.id ON DELETE CASCADE | |
| `group_id` | uuid **NULLABLE** FK → practice_groups.id **ON DELETE SET NULL** | Nullable so sessions are retained when a group is deleted |
| `score_pct` | int NOT NULL | 0–100 integer |
| `played_at` | timestamptz NOT NULL DEFAULT now() | |

> **Note:** `group_id ON DELETE SET NULL` (not CASCADE). This retains historical session rows when an admin deletes a group. The group name/icon is lost, but the score record remains.

### RLS Policies

**`practice_groups`**
- `SELECT`: `is_active = true AND auth.uid() IS NOT NULL`
- `INSERT/UPDATE/DELETE`: service role only (admin uses `createServiceClient()`)

**`practice_group_words`**
- `SELECT`: `auth.uid() IS NOT NULL`
- `INSERT/UPDATE/DELETE`: service role only

**`practice_sessions`**
- `SELECT`: `USING (user_id = auth.uid())`
- `INSERT`: `WITH CHECK (user_id = auth.uid())` — prevents spoofed `user_id`
- No `UPDATE` or `DELETE` for users

---

## Practice Hub (`/practice`)

Server component. Auth flow:
1. `createClient()` → get user; redirect `/login` if unauthenticated
2. Check `users.is_approved`; redirect `/access-denied` if false
3. `createServiceClient()` → fetch all active groups (ordered by `created_at ASC`)
4. Query `practice_sessions` for the user's best score per group

Data passed as props to client children:
```ts
type PracticeGroupSummary = {
  id: string
  name: string
  icon: string
  word_count: 20           // always 20 for active groups; hardcoded constant is safe
  best_score: number | null
}
```

### Grid View (default)
- 2-column grid of colour-coded cards
- Each card: emoji (large), group name (bold), "20 words" subtitle
- Card background cycles through a fixed warm-pastel colour palette (same palette used in `CardStack` GRADIENTS array)
- Tapping a card navigates to `/practice/[id]`

### List View
- Single-column scrollable list
- Each row: emoji in a tinted circle, group name, progress bar (`scoreColor(best_score)`) + score % label; dash if `best_score` is null
- Tapping a row navigates to `/practice/[id]`

### Toggle Button
- Positioned top-right of the page header
- Shows "☰ List" when in grid view; "⊞ Grid" when in list view
- Active view: purple filled button; inactive: grey outline
- Preference stored in `localStorage` key `practice-view`
- **SSR guard:** The client component reads `localStorage` inside `useEffect` only. The server-rendered default is always grid. The client corrects after hydration. This prevents a hydration mismatch.

---

## Practice Game (`/practice/[id]`)

Server component. Auth: same two checks as Practice Hub (unauthenticated → `/login`, not approved → `/access-denied`).

Fetches 20 words directly — no API route:
```ts
const { data: wordRows } = await service
  .from('practice_group_words')
  .select('position, words(english_word, thai_translation, image_url, audio_url, part_of_speech, english_example, thai_example)')
  .eq('group_id', id)
  .order('position')
```

Words are shuffled server-side (Fisher-Yates) before being passed to `CardStack`. Every full page navigation to `/practice/[id]` triggers a fresh server render and a new shuffle order.

### CardStack Integration

`CardStack` receives two new optional props (existing props unchanged):

```ts
interface CardStackProps {
  initialSet: DailySetResponse   // reused as-is; set_id = group id, set_date = today's date (dummy values)
  initialProgress: ProgressResult[]
  mode?: 'daily' | 'practice'   // default: 'daily'
  onSessionComplete?: (scorePct: number) => void
}
```

`DailySetResponse` is reused with dummy values: `set_id` = the practice group's UUID, `set_date` = today's date. These fields are not used in practice mode.

When `mode="practice"`:
- Skips all `user_progress` API calls (no row-by-row progress saving)
- On all-cards-graded: computes `scorePct = ROUND(gotItCount / words.length * 100)`, then calls `onSessionComplete(scorePct)`
- The parent (`/practice/[id]` page) supplies `onSessionComplete` as an async function that:
  1. POSTs `{ group_id, score_pct }` to `/api/practice/sessions`
  2. Receives `{ id, score_pct, best_score, is_new_best }` from the response
  3. Navigates to `/practice/[id]/score?pct={score_pct}&best={best_score}&new={is_new_best ? 1 : 0}`

"Play Again" on the score screen uses `router.push('/practice/[id]')` — a full navigation, not `router.refresh()` — ensuring a new server render and a new shuffle.

---

## Score Screen (`/practice/[id]/score`)

Server component that reads `searchParams`. Params: `pct`, `best`, `new`.

Parsing with fallbacks (guards against malformed URL):
```ts
const pct  = Math.min(100, Math.max(0, parseInt(searchParams.pct  ?? '0', 10) || 0))
const best = Math.min(100, Math.max(0, parseInt(searchParams.best ?? '0', 10) || 0))
const isNewBest = searchParams.new === '1'
```

Fetches group name + icon from `practice_groups` by `[id]` (server-side, service client).

Displays:
- Group emoji + name
- Current session score (large, `scoreColor(pct)`)
- Personal best ("`scoreColor(best)`") — label: "Your best"
- If `isNewBest` is true: "New best score! 🎉" banner
- On first play: `isNewBest` is true (API sets it; `pct === best` on first play is handled by the API flag, not client comparison)
- **Play Again** → `router.push('/practice/[id]')`
- **Back to Practice** → `router.push('/practice')`

---

## API Routes

### `POST /api/practice/sessions`

Uses `createClient()` from `lib/supabase/server.ts` (the existing server helper — not the deprecated `createRouteHandlerClient`).

`user_id` is **always** extracted from the server-side Supabase session. It is **never** accepted from the request body.

Auth flow:
1. `createClient()` → get user; 401 if unauthenticated
2. Query `users.is_approved` where `id = user.id`; 403 if not approved
3. Validate body: `group_id` must be a valid UUID and refer to an existing active group; `score_pct` must be int 0–100
4. Insert into `practice_sessions` using `createServiceClient()` with `user_id` from session
5. Query `MAX(score_pct)` for this user + group to determine new best and whether it's a new record

Request body: `{ group_id: string, score_pct: number }`

Response:
```ts
{ id: string, score_pct: number, best_score: number, is_new_best: boolean }
// is_new_best = true if score_pct > previous best, OR if this is the first session for this group
```

### `GET /api/practice/groups`

Used **only** by `PracticeBestScores` (dashboard client component). Not used by the Practice Hub (which fetches server-side).

Auth:
1. `createClient()` → get user; 401 if unauthenticated
2. Query `users.is_approved`; 403 if not approved

Implementation: calls `get_user_practice_best_scores(user.id)` RPC (see below) and joins result with active groups from `practice_groups` table via `createServiceClient()`.

Response: `[{ id, name, icon, best_score: number | null }]` — all active groups, best_score null if no sessions.

### `GET /api/admin/practice-groups/words?q=...`

Admin-only (checked via `users.is_admin`). Runs `ILIKE '%q%'` on `words.english_word`. Returns up to 20 results: `[{ id, english_word, thai_translation }]`.

---

## Admin — Practice Groups

New entry added to `navLinks` array in `app/admin/layout.tsx`:
```ts
{ href: '/admin/practice-groups', label: '🗂️ Practice Groups' }
```
(Follows existing emoji-prefixed label pattern.)

### List page (`/admin/practice-groups`)

Server component. Uses `createServiceClient()` to fetch all groups ordered by `created_at DESC`, with word count via a join or separate count query.

Columns: icon, name, word count (`N / 20`), Active/Draft badge, Edit link.
"+ New Group" → `/admin/practice-groups/new`

### New page (`/admin/practice-groups/new`) and Edit page (`/admin/practice-groups/[id]`)

Client components. Fields:
- **Name** — text input, required
- **Icon** — text input (admin types emoji directly), required, max 2 chars
- **Status toggle** — Active / Draft. Active is disabled (greyed out with tooltip) when word count ≠ 20. Counter shows `"12 / 20 words selected"`.
- **Word picker** (`WordPicker` component): search queries `GET /api/admin/practice-groups/words?q=...`, shows up to 20 suggestions as dropdown, selected words render as removable chips, max 20 enforced both client-side and server-side.

**Save endpoint** (`POST` for new, `PUT` for edit — `/api/admin/practice-groups/[id]`):

Server-side enforces:
- Name and icon non-empty
- `is_active = true` rejected if word count ≠ 20 (returns 422 with message)
- Word replacement is atomic via a dedicated **Supabase RPC** to avoid partial state:

```sql
-- Called as: rpc('replace_practice_group_words', { p_group_id, p_word_ids, p_name, p_icon, p_is_active })
CREATE OR REPLACE FUNCTION replace_practice_group_words(
  p_group_id uuid, p_name text, p_icon text, p_is_active boolean, p_word_ids uuid[]
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE practice_groups SET name=p_name, icon=p_icon, is_active=p_is_active WHERE id=p_group_id;
  DELETE FROM practice_group_words WHERE group_id=p_group_id;
  INSERT INTO practice_group_words (group_id, word_id, position)
    SELECT p_group_id, unnest(p_word_ids), generate_subscripts(p_word_ids, 1);
END;
$$;
```

This function runs inside a single Postgres transaction, eliminating the race window where a group temporarily has zero words.

**Delete** (`DELETE /api/admin/practice-groups/[id]`): hard-deletes the group row. `practice_group_words` rows cascade. `practice_sessions` rows are retained with `group_id = NULL` (`ON DELETE SET NULL`).

---

## Dashboard Changes

The existing daily flashcard chart, greeting, and Play CTA remain unchanged.

New **"PRACTICE — BEST SCORES"** section added below the Play CTA, rendered by `PracticeBestScores` (client component).

`PracticeBestScores` fetches data in `useEffect` via `GET /api/practice/groups` on mount.

**Layout:** horizontally scrollable row (`overflow-x: auto; white-space: nowrap`). Each group renders as an inline-block mini column:
- Emoji (top, centred)
- Group name — CSS truncation: `max-width: 5rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap`
- Mini horizontal progress bar (height 5px), `scoreColor(best_score)` fill
- Score % label below bar, or "—" if never played
- Entire column is a link → `/practice/[id]`

Only active groups shown. Empty state (no active groups or user has never played): `"No practice scores yet — try a group!"`.

### RPC function (in migration 005)

```sql
CREATE OR REPLACE FUNCTION get_user_practice_best_scores(p_user_id uuid)
RETURNS TABLE(group_id uuid, best_score int)
LANGUAGE sql STABLE AS $$
  SELECT group_id, MAX(score_pct)::int AS best_score
  FROM practice_sessions
  WHERE user_id = p_user_id
    AND group_id IS NOT NULL
  GROUP BY group_id;
$$;
```

---

## Component Map

| Component | Path | Server/Client | Notes |
|---|---|---|---|
| `PracticeHub` | `app/(app)/practice/page.tsx` | Server | Fetches groups + best scores; passes as props |
| `PracticeGroupGrid` | `components/practice/PracticeGroupGrid.tsx` | Client | Grid view; reads localStorage in `useEffect` |
| `PracticeGroupList` | `components/practice/PracticeGroupList.tsx` | Client | List view with progress bars |
| `PracticePlay` | `app/(app)/practice/[id]/page.tsx` | Server | Shuffles words; renders CardStack `mode="practice"` |
| `PracticeScoreScreen` | `app/(app)/practice/[id]/score/page.tsx` | Server | Reads `searchParams`; parses with fallbacks |
| `PracticeBestScores` | `components/dashboard/PracticeBestScores.tsx` | Client | Horizontal scroll row; fetches via GET API |
| Admin list | `app/admin/practice-groups/page.tsx` | Server | |
| Admin new | `app/admin/practice-groups/new/page.tsx` | Client | |
| Admin edit | `app/admin/practice-groups/[id]/page.tsx` | Client | |
| `WordPicker` | `components/admin/WordPicker.tsx` | Client | Search + chip selector, reusable |

---

## Migration File

`supabase/migrations/005_practice_module.sql`

Creates:
- `practice_groups` table
- `practice_group_words` table (with `CHECK (position BETWEEN 1 AND 20)`)
- `practice_sessions` table (`group_id` nullable, `ON DELETE SET NULL`)
- All RLS policies with explicit `USING` and `WITH CHECK` clauses
- `get_user_practice_best_scores` RPC function
- `replace_practice_group_words` RPC function (atomic word replacement for admin)

---

## Out of Scope

- Word-level tracking within practice sessions
- Practice scores feeding into daily streak or gamification
- Admin drag-and-drop group reordering
- User-created custom groups
