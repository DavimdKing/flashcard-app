# Word Examples, Part of Speech & Excel Bulk Import — Design Spec

**Date:** 2026-03-25
**Status:** Approved

---

## Overview

Two related features extending the English–Thai flashcard app:

1. **Word metadata** — add Part of Speech, English example sentence, and Thai example sentence to each word. Display them on the flashcard back face (Thai answer side).
2. **Excel bulk import** — admin can upload a `.xlsx` file to add many words at once, preview validation results before confirming, and later add images to imported words via a dedicated queue page.

---

## Canonical Constants

Define a single exported constant in `lib/constants.ts`:

```ts
export const PARTS_OF_SPEECH = [
  'noun', 'verb', 'adjective', 'adverb',
  'phrase', 'conjunction', 'preposition', 'pronoun', 'interjection'
] as const
export type PartOfSpeech = typeof PARTS_OF_SPEECH[number]
```

This is the single source of truth used by the admin form dropdown, the API validation, and the Excel import validation.

---

## Auth Pattern

All new admin API routes use the same `requireAdmin()` pattern already present in every existing admin route. Each route file defines it locally (it is not a shared import):

```ts
async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: appUser } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
  if (!appUser?.is_admin) return null
  return user
}
```

All client-side calls to admin API routes (including check-duplicates) are made from the browser with the session cookie automatically included by Next.js. No additional auth setup is needed.

---

## Feature 1: Word Metadata (Part of Speech + Examples)

### 1.1 Database

New migration: `supabase/migrations/003_add_word_examples.sql`

Migrations 001 and 002 already exist. This is migration 003.

```sql
ALTER TABLE words
  ADD COLUMN part_of_speech  text,
  ADD COLUMN english_example text,
  ADD COLUMN thai_example    text;
```

Exact column names: `part_of_speech`, `english_example`, `thai_example`. All nullable. The `is_deleted` column already exists on the `words` table (added in migration 001). No DB-level enum constraint on `part_of_speech` — validation enforced at API layer.

### 1.2 TypeScript Types

Update `lib/types.ts`:

- `Word` interface: add `part_of_speech: string | null`, `english_example: string | null`, `thai_example: string | null`
- `DailySetResponse` word shape: include all three new fields

### 1.3 Admin Word Form (`components/admin/WordForm.tsx`)

Import `PARTS_OF_SPEECH` from `lib/constants.ts`. Add three optional fields below Thai Translation, above image upload:

| Field | Input | Required |
|---|---|---|
| Part of Speech | Dropdown | No |
| English Example | Textarea | No |
| Thai Example | Textarea | No |

- Dropdown first option is blank (empty string), submitted as `null`
- Remaining options rendered from `PARTS_OF_SPEECH`
- In **edit mode**: fields pre-filled with existing values
- Empty textarea submits as `null`

### 1.4 Admin API Routes

Update `POST /api/admin/words` and `PUT /api/admin/words/[id]`:
- Accept `part_of_speech`, `english_example`, `thai_example` in request body (all optional)
- Validate `part_of_speech`: must be one of `PARTS_OF_SPEECH` or `null`; return 400 if unknown value
- Include in DB insert/update

Update `GET /api/daily-set`:
- Return `part_of_speech`, `english_example`, `thai_example` in word objects
- Null values included in JSON as `null` (not omitted)

### 1.5 Flashcard Back Face (`components/game/FlashCard.tsx`)

The sound button is **absolute-positioned top-left** (unchanged).

Centered content, top to bottom:

1. **Thai word** — large bold white
2. **Part of speech** — small italic muted blue (`text-blue-200`), only rendered if `part_of_speech !== null`
3. **Image** — centered at current size; if `image_url` is null, render a grey placeholder: `<div className="w-[160px] h-[160px] bg-white/10 rounded-lg" />`
4. **English example** — italic white text, only rendered if `english_example !== null`
5. **Thin divider** — `<div className="w-10 h-px bg-white/20 mx-auto" />` — only rendered if both `english_example` and `thai_example` are non-null
6. **Thai example** — italic white text, only rendered if `thai_example !== null`

If none of items 2, 4, 6 are present, the card looks identical to the current design.

---

## Feature 2: Excel Bulk Import

### 2.1 Expected Excel Format

| Column 1 | Column 2 | Column 3 | Column 4 | Column 5 |
|---|---|---|---|---|
| Vocabulary | Part of Speech | Thai Meaning | Thai Example | English Example |

- Row 1 must be a header row with these exact names (case-insensitive): `Vocabulary`, `Part of Speech`, `Thai Meaning`, `Thai Example`, `English Example`. Client validates all five names are present. If any are missing or wrong, show an error before rendering the preview: *"File format does not match the expected template. Please check column headers."*
- Maximum **200 data rows** per upload. If exceeded, reject at parse time: *"This file has more than 200 rows. Please split it into smaller batches."*
- Required: Column 1 (Vocabulary) and Column 3 (Thai Meaning)
- Optional: Columns 2, 4, 5 — blank cells saved as `null`
- Column 2 (Part of Speech): if present, must be one of `PARTS_OF_SPEECH` (case-insensitive). Invalid values are flagged with error badge "✗ Invalid POS" and treated as errors (not imported). Valid values are normalised to lowercase before sending to the API.

### 2.2 Import Page (`app/admin/words/import/page.tsx`)

Accessible from the admin words list via an **"Import from Excel"** button.

**Step 1 — Upload:**
- Drag & drop or click-to-browse for `.xlsx` files only
- On file selection (in order):
  1. Validate header row — show error and stop if mismatch
  2. Check row count — show error and stop if > 200
  3. Parse all rows client-side with the `xlsx` library
  4. POST `english_word` values to `POST /api/admin/words/check-duplicates` to find DB duplicates
  5. Detect intra-file duplicates client-side (case-insensitive `toLowerCase()`). **First occurrence = valid; all subsequent occurrences = "✗ Duplicate in file"**
  6. Render preview table

**Step 2 — Preview table:**

Columns: #, Vocabulary, POS, Thai Meaning, English Example, Thai Example, Status

| Badge | Colour | Condition |
|---|---|---|
| ✓ Ready | Green | Passes all validation |
| ✗ Missing Vocabulary | Red | Column 1 blank |
| ✗ Missing Thai | Red | Column 3 blank |
| ✗ Duplicate in DB | Red | Exists in database (case-insensitive) |
| ✗ Duplicate in file | Red | Second+ occurrence of same vocabulary |
| ✗ Invalid POS | Red | Part of speech not in allowed list |

Summary bar: "X ready to import / Y have errors"

Actions:
- **"Change file"** — resets to upload zone
- **"Save X valid words →"** — disabled if 0 valid rows

**Step 3 — Save:**
- POST only valid rows to `POST /api/admin/words/bulk-import`
- Button shows loading state
- On completion show summary:
  - *"6 words saved successfully."*
  - TTS failures (if any): *"Audio generation failed for: cat, run. You can retry from each word's edit page."*
  - DB insertion failures (if any): *"Failed to save: quickly. Please try re-importing these words."*

### 2.3 Bulk Import API (`POST /api/admin/words/bulk-import`)

**Auth:** `requireAdmin()` pattern (defined locally in the route file). Return 403 if not admin.

**Request body:**
```ts
{
  words: Array<{
    english_word: string        // maps to words.english_word
    thai_translation: string    // maps to words.thai_translation
    part_of_speech: string | null
    english_example: string | null
    thai_example: string | null
  }>
}
```

**TTS:** Uses `synthesizeSpeech(english_word)` imported from `lib/tts.ts`. Signature: `async function synthesizeSpeech(word: string): Promise<Buffer>`. It calls the Google Cloud TTS REST API and returns an MP3 `Buffer`. It **throws** on failure (network error, missing API key, or no audio content returned). Wrap in try/catch — a throw means TTS failed, not a DB error. On success, upload the buffer to Supabase Storage bucket `tts` at path `tts/{id}.mp3`, get the public URL, and set `audio_url`. On failure (catch), `audio_url` remains null.

**Server-side deduplication:** Before inserting, the API checks for duplicates within the submitted batch itself (case-insensitive) and against the DB (same query as check-duplicates). Any duplicate found server-side is added to `errors` with reason "Duplicate word". This prevents DB constraint errors even if the client sends duplicates.

**Processing — partial/best-effort (not all-or-nothing):**
Each word inserted independently. A failure on one row does not affect others.

For each word:
1. Generate UUID (`crypto.randomUUID()`)
2. Insert into `words` with `image_url = null`
3. Attempt TTS — non-fatal

**Response:**
```ts
{
  saved: number
  audio_failures: string[]                            // english_word values where TTS failed
  errors: Array<{ english_word: string, reason: string }> // words that failed DB insert
}
```

### 2.4 Duplicate Check API (`POST /api/admin/words/check-duplicates`)

**Auth:** `requireAdmin()` pattern (defined locally). Return 403 if not admin.

**Request:** `{ words: string[] }`
**Response:** `{ duplicates: string[] }`

SQL: `SELECT english_word FROM words WHERE lower(english_word) = ANY(ARRAY[...lower values...]) AND is_deleted = false`

Returns the matched `english_word` values (as stored in DB) so the client can do case-insensitive comparison.

### 2.5 No-Image Queue (`app/admin/words/no-image/page.tsx`)

Server-side rendered. Auth is enforced by the existing `app/admin/layout.tsx` which already redirects non-admin users — no additional auth check needed in this page. Query: `words WHERE image_url IS NULL AND is_deleted = false ORDER BY created_at DESC`.

**Pagination:** 20 rows per page. Page passed as `?page=1` (defaults to 1 if absent). Out-of-range pages show the empty state (not a 404).

**Count badge:** Fetched via a separate `SELECT COUNT(*) FROM words WHERE image_url IS NULL AND is_deleted = false` query server-side — a global count of all words without images, not just the current page. Shown in the nav link as **"No Image (N)"**.

**Table columns:** English word, Thai meaning, Part of Speech, Status badge ("No image"), "Add Image" button → `/admin/words/[id]`

**Empty state:** *"All words have images."*

---

## Files Changed / Created

| File | Change |
|---|---|
| `lib/constants.ts` | New — exports PARTS_OF_SPEECH constant |
| `supabase/migrations/003_add_word_examples.sql` | New — adds 3 columns to words table |
| `lib/types.ts` | Update Word and DailySetResponse types |
| `app/api/daily-set/route.ts` | Return 3 new fields in word objects |
| `app/api/admin/words/route.ts` | Accept + validate 3 new fields on POST |
| `app/api/admin/words/[id]/route.ts` | Accept + validate 3 new fields on PUT |
| `app/api/admin/words/bulk-import/route.ts` | New — batch insert + TTS, partial save |
| `app/api/admin/words/check-duplicates/route.ts` | New — case-insensitive DB duplicate check |
| `components/admin/WordForm.tsx` | Add POS dropdown + 2 example textareas |
| `components/game/FlashCard.tsx` | Update back face layout with conditional fields |
| `app/admin/words/import/page.tsx` | New — xlsx upload, client parse, preview, save |
| `app/admin/words/no-image/page.tsx` | New — paginated queue, 20/page, created_at desc |
| `app/admin/words/page.tsx` | Add "Import from Excel" button + "No Image (N)" nav link |
