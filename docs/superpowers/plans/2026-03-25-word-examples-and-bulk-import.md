# Word Examples, Part of Speech & Excel Bulk Import — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Part of Speech + example sentences to each flashcard word, display them on the Thai answer card face, and allow admins to bulk-import words from an Excel file with a preview/confirm flow.

**Architecture:** Feature 1 adds 3 nullable columns to the `words` table, threads them through the API and types, updates the admin form and flashcard component. Feature 2 adds two new API routes (bulk-import, check-duplicates) and two new admin pages (import, no-image queue). Feature 1 must be completed before Feature 2 since the bulk-import API uses the same new columns.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (PostgreSQL + Storage), Tailwind CSS, `xlsx` npm library (client-side Excel parsing)

> **Note:** Before writing any Next.js code, check `node_modules/next/dist/docs/` for API details — this project uses Next.js 16 which has breaking changes from earlier versions. The project has no automated test runner; verification steps use `npx tsc --noEmit` and manual browser testing.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `lib/constants.ts` | Create | PARTS_OF_SPEECH canonical list |
| `supabase/migrations/003_add_word_examples.sql` | Create | Add 3 columns + make image_url nullable |
| `lib/types.ts` | Modify | Add 3 new fields to Word + DailySetResponse |
| `app/api/daily-set/route.ts` | Modify | Return 3 new fields in word objects |
| `app/api/admin/words/route.ts` | Modify | Accept + validate 3 new fields on POST |
| `app/api/admin/words/[id]/route.ts` | Modify | Accept + validate 3 new fields on PUT |
| `components/admin/WordForm.tsx` | Modify | POS dropdown + 2 example textareas |
| `components/game/FlashCard.tsx` | Modify | Back face: POS, placeholder image, examples |
| `app/api/admin/words/check-duplicates/route.ts` | Create | Case-insensitive DB duplicate check |
| `app/api/admin/words/bulk-import/route.ts` | Create | Batch insert + TTS, best-effort per row |
| `app/admin/words/import/page.tsx` | Create | Client component: xlsx upload + preview + save |
| `app/admin/words/no-image/page.tsx` | Create | SSR: paginated words-without-images queue |
| `app/admin/words/page.tsx` | Modify | Add "Import" button + "No Image" nav link |
| `app/admin/layout.tsx` | Modify | Add "No Image (N)" nav link with live count |

---

## Task 1: Constants File

**Files:**
- Create: `lib/constants.ts`

- [ ] **Step 1: Create the constants file**

```typescript
// lib/constants.ts
export const PARTS_OF_SPEECH = [
  'noun',
  'verb',
  'adjective',
  'adverb',
  'phrase',
  'conjunction',
  'preposition',
  'pronoun',
  'interjection',
] as const

export type PartOfSpeech = typeof PARTS_OF_SPEECH[number]
```

- [ ] **Step 2: Verify TypeScript compiles**

Run from `flashcard-app/`:
```bash
npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add lib/constants.ts
git commit -m "feat: add PARTS_OF_SPEECH constants"
```

---

## Task 2: Database Migration 003

**Files:**
- Create: `supabase/migrations/003_add_word_examples.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/003_add_word_examples.sql
ALTER TABLE words
  ADD COLUMN IF NOT EXISTS part_of_speech  text,
  ADD COLUMN IF NOT EXISTS english_example text,
  ADD COLUMN IF NOT EXISTS thai_example    text;

-- Allow image_url to be null (needed for bulk-imported words without images)
ALTER TABLE words
  ALTER COLUMN image_url DROP NOT NULL;
```

- [ ] **Step 2: Run migration in Supabase**

Go to Supabase Dashboard → SQL Editor → paste the SQL above → Run.

- [ ] **Step 3: Verify columns exist**

In Supabase Table Editor → `words` table → confirm these columns exist:
- `part_of_speech` (text, nullable)
- `english_example` (text, nullable)
- `thai_example` (text, nullable)
- `image_url` now accepts null

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/003_add_word_examples.sql
git commit -m "feat: migration 003 — add part_of_speech, example columns; make image_url nullable"
```

---

## Task 3: Update TypeScript Types

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Update Word interface**

In `lib/types.ts`, change the `Word` interface from:
```typescript
export interface Word {
  id: string
  english_word: string
  thai_translation: string
  image_url: string
  audio_url: string | null
  is_deleted: boolean
  created_at: string
  updated_at: string
}
```
To:
```typescript
export interface Word {
  id: string
  english_word: string
  thai_translation: string
  image_url: string | null
  audio_url: string | null
  part_of_speech: string | null
  english_example: string | null
  thai_example: string | null
  is_deleted: boolean
  created_at: string
  updated_at: string
}
```

- [ ] **Step 2: Update DailySetResponse word shape**

In `lib/types.ts`, change the `DailySetResponse` words array type from:
```typescript
export interface DailySetResponse {
  set_id: string
  set_date: string
  words: Array<{
    word_id: string
    position: number
    english_word: string
    thai_translation: string
    image_url: string
    audio_url: string | null
  }>
}
```
To:
```typescript
export interface DailySetResponse {
  set_id: string
  set_date: string
  words: Array<{
    word_id: string
    position: number
    english_word: string
    thai_translation: string
    image_url: string | null
    audio_url: string | null
    part_of_speech: string | null
    english_example: string | null
    thai_example: string | null
  }>
}
```

- [ ] **Step 3: Run TypeScript check**

```bash
npx tsc --noEmit
```
Expected: Errors will appear in files that use `image_url` as non-nullable — these will be fixed in subsequent tasks. For now, note which files error and proceed.

- [ ] **Step 4: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add part_of_speech, example fields to Word and DailySetResponse types"
```

---

## Task 4: Update daily-set API

**Files:**
- Modify: `app/api/daily-set/route.ts`

- [ ] **Step 1: Update the Supabase select to include new columns**

In `app/api/daily-set/route.ts`, find the `daily_set_words` select query and update the nested `words` select from:
```typescript
words ( english_word, thai_translation, image_url, audio_url )
```
To:
```typescript
words ( english_word, thai_translation, image_url, audio_url, part_of_speech, english_example, thai_example )
```

- [ ] **Step 2: Update SetWordRow type and mapping**

Change the `SetWordRow` type at the top of the file from:
```typescript
type SetWordRow = {
  word_id: string
  position: number
  english_word: string
  thai_translation: string
  image_url: string
  audio_url: string | null
}
```
To:
```typescript
type SetWordRow = {
  word_id: string
  position: number
  english_word: string
  thai_translation: string
  image_url: string | null
  audio_url: string | null
  part_of_speech: string | null
  english_example: string | null
  thai_example: string | null
}
```

Then update the `.map()` that builds rows to include the new fields:
```typescript
const rows: SetWordRow[] = words
  .filter((w: any) => w.words != null)
  .map((w: any) => ({
    word_id: w.word_id,
    position: w.position,
    english_word: w.words.english_word,
    thai_translation: w.words.thai_translation,
    image_url: w.words.image_url,
    audio_url: w.words.audio_url,
    part_of_speech: w.words.part_of_speech ?? null,
    english_example: w.words.english_example ?? null,
    thai_example: w.words.thai_example ?? null,
  }))
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: No new errors from this file.

- [ ] **Step 4: Manual verify**

In browser: navigate to `/play` and open DevTools → Network → find the `daily-set` API call → confirm the response includes `part_of_speech`, `english_example`, `thai_example` fields (null for existing words).

- [ ] **Step 5: Commit**

```bash
git add app/api/daily-set/route.ts
git commit -m "feat: daily-set API returns part_of_speech, english_example, thai_example"
```

---

## Task 5: Update POST /api/admin/words

**Files:**
- Modify: `app/api/admin/words/route.ts`

- [ ] **Step 1: Import PARTS_OF_SPEECH and update body extraction**

At the top of the file, add:
```typescript
import { PARTS_OF_SPEECH } from '@/lib/constants'
```

In the `POST` handler, find where body fields are extracted:
```typescript
const { id, english_word, thai_translation, image_url } = body
```
Change to:
```typescript
const { id, english_word, thai_translation, image_url, part_of_speech, english_example, thai_example } = body
```

- [ ] **Step 2: Add POS validation**

After the existing required-field check (`if (!id || !english_word || !thai_translation || !image_url)`), add:
```typescript
if (part_of_speech != null && !(PARTS_OF_SPEECH as readonly string[]).includes(part_of_speech)) {
  return NextResponse.json({ error: 'Invalid part_of_speech' }, { status: 400 })
}
```

- [ ] **Step 3: Include new fields in the insert**

Find the insert line:
```typescript
const { error } = await service.from('words').insert({ id, english_word, thai_translation, image_url, audio_url })
```
Change to:
```typescript
const { error } = await service.from('words').insert({
  id,
  english_word,
  thai_translation,
  image_url,
  audio_url,
  part_of_speech: part_of_speech ?? null,
  english_example: english_example ?? null,
  thai_example: thai_example ?? null,
})
```

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/words/route.ts
git commit -m "feat: admin POST words accepts part_of_speech, example fields"
```

---

## Task 6: Update PUT /api/admin/words/[id]

**Files:**
- Modify: `app/api/admin/words/[id]/route.ts`

- [ ] **Step 1: Import PARTS_OF_SPEECH and update body extraction**

Add import at top:
```typescript
import { PARTS_OF_SPEECH } from '@/lib/constants'
```

In the `PUT` handler, find:
```typescript
const { english_word, thai_translation, image_url } = body
```
Change to:
```typescript
const { english_word, thai_translation, image_url, part_of_speech, english_example, thai_example } = body
```

- [ ] **Step 2: Add POS validation**

After body destructuring, add:
```typescript
if (part_of_speech != null && !(PARTS_OF_SPEECH as readonly string[]).includes(part_of_speech)) {
  return NextResponse.json({ error: 'Invalid part_of_speech' }, { status: 400 })
}
```

- [ ] **Step 3: Include new fields in the updates object**

Find the `updates` object construction:
```typescript
const updates: Record<string, string | null> = { english_word, thai_translation }
if (image_url) updates.image_url = image_url
if (audio_url) updates.audio_url = audio_url
```
Change to:
```typescript
const updates: Record<string, string | null> = {
  english_word,
  thai_translation,
  part_of_speech: part_of_speech ?? null,
  english_example: english_example ?? null,
  thai_example: thai_example ?? null,
}
if (image_url) updates.image_url = image_url
if (audio_url) updates.audio_url = audio_url
```

- [ ] **Step 4: TypeScript check + commit**

```bash
npx tsc --noEmit
git add app/api/admin/words/[id]/route.ts
git commit -m "feat: admin PUT words accepts part_of_speech, example fields"
```

---

## Task 7: Update Admin Word Form

**Files:**
- Modify: `components/admin/WordForm.tsx`

- [ ] **Step 1: Import PARTS_OF_SPEECH and add state**

At the top of the file, add:
```typescript
import { PARTS_OF_SPEECH } from '@/lib/constants'
```

Inside the component, after the existing state declarations, add:
```typescript
const [partOfSpeech, setPartOfSpeech] = useState<string>(word?.part_of_speech ?? '')
const [englishExample, setEnglishExample] = useState(word?.english_example ?? '')
const [thaiExample, setThaiExample] = useState(word?.thai_example ?? '')
```

- [ ] **Step 2: Include new fields in the save request body**

Find the JSON.stringify in `handleSubmit`:
```typescript
body: JSON.stringify({ id: wordId, english_word: englishWord, thai_translation: thaiTranslation, image_url: imageUrl }),
```
Change to:
```typescript
body: JSON.stringify({
  id: wordId,
  english_word: englishWord,
  thai_translation: thaiTranslation,
  image_url: imageUrl,
  part_of_speech: partOfSpeech || null,
  english_example: englishExample || null,
  thai_example: thaiExample || null,
}),
```

- [ ] **Step 3: Add form fields to the JSX**

After the Thai Translation `<label>` block and before the Image `<label>` block, add:

```tsx
<label className="flex flex-col gap-1">
  <span className="text-sm font-medium text-gray-600">Part of Speech</span>
  <select
    value={partOfSpeech}
    onChange={e => setPartOfSpeech(e.target.value)}
    className="border rounded-xl px-3 py-2 text-gray-800 focus:outline-purple-400"
  >
    <option value="">— optional —</option>
    {PARTS_OF_SPEECH.map(pos => (
      <option key={pos} value={pos}>{pos}</option>
    ))}
  </select>
</label>

<label className="flex flex-col gap-1">
  <span className="text-sm font-medium text-gray-600">English Example</span>
  <textarea
    value={englishExample}
    onChange={e => setEnglishExample(e.target.value)}
    rows={2}
    placeholder="e.g. The cat sat on the mat."
    className="border rounded-xl px-3 py-2 text-gray-800 focus:outline-purple-400 resize-none"
  />
</label>

<label className="flex flex-col gap-1">
  <span className="text-sm font-medium text-gray-600">Thai Example</span>
  <textarea
    value={thaiExample}
    onChange={e => setThaiExample(e.target.value)}
    rows={2}
    placeholder="e.g. แมวนั่งอยู่บนพรม"
    className="border rounded-xl px-3 py-2 text-gray-800 focus:outline-purple-400 resize-none"
  />
</label>
```

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Manual verify**

Visit `/admin/words/new` — confirm the 3 new fields appear. Create a word with POS "noun" and an example. Confirm it saves (check Supabase Table Editor for the row).

- [ ] **Step 6: Commit**

```bash
git add components/admin/WordForm.tsx
git commit -m "feat: WordForm adds part_of_speech dropdown and example textareas"
```

---

## Task 8: Update Flashcard Back Face

**Files:**
- Modify: `components/game/FlashCard.tsx`

- [ ] **Step 1: Update the back face JSX**

In `components/game/FlashCard.tsx`, find the back face `<div>`:

```tsx
{/* Back face */}
<div
  className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${bgGradient} flex flex-col items-center justify-center gap-4 p-6 shadow-xl`}
  style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', visibility: isFlipped ? 'visible' : 'hidden' }}
>
  <div className="absolute top-4 left-4">
    <SoundButton audioUrl={word.audio_url} />
  </div>
  <h2 className="text-4xl font-bold text-white drop-shadow">{word.thai_translation}</h2>
  {/* eslint-disable-next-line @next/next/no-img-element */}
  <img
    src={word.image_url}
    alt={word.thai_translation}
    className={`w-80 h-80 object-contain rounded-2xl ${imgAnimation}`}
  />
</div>
```

Replace it with:

```tsx
{/* Back face */}
<div
  className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${bgGradient} flex flex-col items-center justify-center gap-3 p-6 shadow-xl`}
  style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', visibility: isFlipped ? 'visible' : 'hidden' }}
>
  <div className="absolute top-4 left-4">
    <SoundButton audioUrl={word.audio_url} />
  </div>

  {/* Thai word */}
  <h2 className="text-4xl font-bold text-white drop-shadow text-center">{word.thai_translation}</h2>

  {/* Part of speech */}
  {word.part_of_speech && (
    <p className="text-sm italic text-blue-200">{word.part_of_speech}</p>
  )}

  {/* Image or placeholder */}
  {word.image_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={word.image_url}
      alt={word.thai_translation}
      className={`w-40 h-40 object-contain rounded-2xl ${imgAnimation}`}
    />
  ) : (
    <div className={`w-40 h-40 bg-white/10 rounded-2xl ${imgAnimation}`} />
  )}

  {/* Example sentences */}
  {word.english_example && (
    <p className="text-sm italic text-white/90 text-center px-2">{word.english_example}</p>
  )}
  {word.english_example && word.thai_example && (
    <div className="w-10 h-px bg-white/20" />
  )}
  {word.thai_example && (
    <p className="text-sm italic text-white/90 text-center px-2">{word.thai_example}</p>
  )}
</div>
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 3: Manual verify**

Play the game with a word that has POS and examples. Confirm:
- Part of speech shows in italic blue below the Thai word
- Image shows (or grey box if none)
- English example shows below image
- Divider shows between examples
- Thai example shows last
- Words without examples look identical to before

- [ ] **Step 4: Commit**

```bash
git add components/game/FlashCard.tsx
git commit -m "feat: flashcard back face shows part_of_speech, example sentences, image placeholder"
```

---

## Task 9: Check-Duplicates API

**Files:**
- Create: `app/api/admin/words/check-duplicates/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// app/api/admin/words/check-duplicates/route.ts
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
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null)
  if (!body || !Array.isArray(body.words)) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const words: string[] = body.words
  if (words.length === 0) return NextResponse.json({ duplicates: [] })

  const service = createServiceClient()
  const { data, error } = await service
    .from('words')
    .select('english_word')
    .eq('is_deleted', false)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const existingLower = new Set(
    (data ?? []).map((r: { english_word: string }) => r.english_word.toLowerCase())
  )
  const duplicates = words.filter(w => existingLower.has(w.toLowerCase()))

  return NextResponse.json({ duplicates })
}
```

- [ ] **Step 2: TypeScript check + commit**

```bash
npx tsc --noEmit
git add app/api/admin/words/check-duplicates/route.ts
git commit -m "feat: add check-duplicates API for bulk import"
```

---

## Task 10: Bulk Import API

**Files:**
- Create: `app/api/admin/words/bulk-import/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// app/api/admin/words/bulk-import/route.ts
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { synthesizeSpeech } from '@/lib/tts'
import { PARTS_OF_SPEECH } from '@/lib/constants'
import { NextResponse } from 'next/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: appUser } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
  return appUser?.is_admin ? user : null
}

interface ImportWord {
  english_word: string
  thai_translation: string
  part_of_speech: string | null
  english_example: string | null
  thai_example: string | null
}

export async function POST(request: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null)
  if (!body || !Array.isArray(body.words)) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const words: ImportWord[] = body.words
  const service = createServiceClient()

  // Server-side dedup: fetch all existing words (case-insensitive)
  const { data: existingData } = await service
    .from('words')
    .select('english_word')
    .eq('is_deleted', false)

  const existingLower = new Set(
    (existingData ?? []).map((r: { english_word: string }) => r.english_word.toLowerCase())
  )

  let saved = 0
  const audioFailures: string[] = []
  const errors: Array<{ english_word: string; reason: string }> = []

  // Track words inserted in this batch to catch intra-batch dupes
  const batchInserted = new Set<string>()

  for (const word of words) {
    const wordLower = word.english_word.toLowerCase()

    // Server-side duplicate check
    if (existingLower.has(wordLower) || batchInserted.has(wordLower)) {
      errors.push({ english_word: word.english_word, reason: 'Duplicate word' })
      continue
    }

    // Validate POS
    if (
      word.part_of_speech != null &&
      !(PARTS_OF_SPEECH as readonly string[]).includes(word.part_of_speech)
    ) {
      errors.push({ english_word: word.english_word, reason: 'Invalid part of speech' })
      continue
    }

    const id = crypto.randomUUID()
    let audio_url: string | null = null

    // Attempt TTS (non-fatal)
    try {
      const audioBuffer = await synthesizeSpeech(word.english_word)
      const filePath = `tts/${id}.mp3`
      await service.storage.from('tts').upload(filePath, audioBuffer, { contentType: 'audio/mpeg' })
      const { data: { publicUrl } } = service.storage.from('tts').getPublicUrl(filePath)
      audio_url = publicUrl
    } catch {
      audioFailures.push(word.english_word)
    }

    // Insert word
    const { error: insertError } = await service.from('words').insert({
      id,
      english_word: word.english_word,
      thai_translation: word.thai_translation,
      part_of_speech: word.part_of_speech ?? null,
      english_example: word.english_example ?? null,
      thai_example: word.thai_example ?? null,
      image_url: null,
      audio_url,
      is_deleted: false,
    })

    if (insertError) {
      errors.push({ english_word: word.english_word, reason: insertError.message })
    } else {
      saved++
      batchInserted.add(wordLower)
      existingLower.add(wordLower) // Prevent future rows in same batch from duplicating
    }
  }

  return NextResponse.json({ saved, audio_failures: audioFailures, errors })
}
```

- [ ] **Step 2: TypeScript check + commit**

```bash
npx tsc --noEmit
git add app/api/admin/words/bulk-import/route.ts
git commit -m "feat: add bulk-import API with best-effort insert and TTS"
```

---

## Task 11: Excel Import Page

**Files:**
- Create: `app/admin/words/import/page.tsx`

This is a client component — Excel parsing happens in the browser. Install the `xlsx` library first.

- [ ] **Step 1: Install xlsx**

```bash
cd flashcard-app
npm install xlsx
```

- [ ] **Step 2: Create the import page**

```typescript
// app/admin/words/import/page.tsx
'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { PARTS_OF_SPEECH } from '@/lib/constants'
import { createClient } from '@/lib/supabase/client'

const REQUIRED_HEADERS = ['vocabulary', 'part of speech', 'thai meaning', 'thai example', 'english example']
const MAX_ROWS = 200

interface ParsedRow {
  rowNum: number
  english_word: string
  part_of_speech: string | null
  thai_translation: string
  thai_example: string | null
  english_example: string | null
  errors: string[]
}

type SaveResult = {
  saved: number
  audio_failures: string[]
  errors: Array<{ english_word: string; reason: string }>
} | null

export default function ImportPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [saving, setSaving] = useState(false)
  const [saveResult, setSaveResult] = useState<SaveResult>(null)
  const [parseError, setParseError] = useState('')

  const supabase = createClient()

  const validRows = rows.filter(r => r.errors.length === 0)
  const errorRows = rows.filter(r => r.errors.length > 0)

  const handleFile = async (file: File) => {
    setParseError('')
    setSaveResult(null)
    setRows([])
    setFileName(file.name)

    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const raw: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

    if (raw.length < 2) {
      setParseError('File appears to be empty or has no data rows.')
      return
    }

    // Validate headers (row 0)
    const headers = (raw[0] as string[]).map(h => String(h).toLowerCase().trim())
    const missingHeaders = REQUIRED_HEADERS.filter(h => !headers.includes(h))
    if (missingHeaders.length > 0) {
      setParseError(`File format does not match the expected template. Missing headers: ${missingHeaders.join(', ')}. Please check column headers.`)
      return
    }

    const dataRows = raw.slice(1).filter(r => r.some(cell => String(cell).trim() !== ''))

    if (dataRows.length > MAX_ROWS) {
      setParseError(`This file has more than ${MAX_ROWS} rows. Please split it into smaller batches.`)
      return
    }

    // Map header positions
    const colIdx = {
      vocabulary: headers.indexOf('vocabulary'),
      pos: headers.indexOf('part of speech'),
      thai: headers.indexOf('thai meaning'),
      thaiEx: headers.indexOf('thai example'),
      engEx: headers.indexOf('english example'),
    }

    // Parse rows
    const parsed: ParsedRow[] = dataRows.map((row, i) => {
      const get = (idx: number) => String((row as string[])[idx] ?? '').trim() || null
      const english_word = get(colIdx.vocabulary) ?? ''
      const thai_translation = get(colIdx.thai) ?? ''
      const posRaw = get(colIdx.pos)
      const part_of_speech = posRaw ? posRaw.toLowerCase() : null
      const thai_example = get(colIdx.thaiEx)
      const english_example = get(colIdx.engEx)

      const errors: string[] = []
      if (!english_word) errors.push('Missing Vocabulary')
      if (!thai_translation) errors.push('Missing Thai')
      if (part_of_speech && !(PARTS_OF_SPEECH as readonly string[]).includes(part_of_speech)) {
        errors.push('Invalid POS')
      }

      return { rowNum: i + 2, english_word, part_of_speech, thai_translation, thai_example, english_example, errors }
    })

    // Detect intra-file duplicates (first wins)
    const seen = new Set<string>()
    for (const row of parsed) {
      if (!row.english_word) continue
      const key = row.english_word.toLowerCase()
      if (seen.has(key)) {
        row.errors.push('Duplicate in file')
      } else {
        seen.add(key)
      }
    }

    // Check DB duplicates
    const { data: { session } } = await supabase.auth.getSession()
    const allWords = parsed.map(r => r.english_word).filter(Boolean)
    if (allWords.length > 0) {
      const res = await fetch('/api/admin/words/check-duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ words: allWords }),
      })
      if (res.ok) {
        const { duplicates }: { duplicates: string[] } = await res.json()
        const dupSet = new Set(duplicates.map(d => d.toLowerCase()))
        for (const row of parsed) {
          if (dupSet.has(row.english_word.toLowerCase()) && !row.errors.includes('Duplicate in file')) {
            row.errors.push('Duplicate in DB')
          }
        }
      }
    }

    setRows(parsed)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const handleSave = async () => {
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/admin/words/bulk-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({
        words: validRows.map(r => ({
          english_word: r.english_word,
          thai_translation: r.thai_translation,
          part_of_speech: r.part_of_speech,
          english_example: r.english_example,
          thai_example: r.thai_example,
        })),
      }),
    })
    const result = await res.json()
    setSaveResult(result)
    setSaving(false)
  }

  const STATUS_BADGE: Record<string, string> = {
    'Missing Vocabulary': 'bg-red-100 text-red-700',
    'Missing Thai': 'bg-red-100 text-red-700',
    'Duplicate in DB': 'bg-red-100 text-red-700',
    'Duplicate in file': 'bg-red-100 text-red-700',
    'Invalid POS': 'bg-red-100 text-red-700',
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Import Words from Excel</h2>

      {/* Save result */}
      {saveResult && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-2xl">
          <p className="font-semibold text-green-800">{saveResult.saved} words saved successfully.</p>
          {saveResult.audio_failures.length > 0 && (
            <p className="text-sm text-yellow-700 mt-1">
              Audio generation failed for: {saveResult.audio_failures.join(', ')}. You can retry from each word&apos;s edit page.
            </p>
          )}
          {saveResult.errors.length > 0 && (
            <p className="text-sm text-red-700 mt-1">
              Failed to save: {saveResult.errors.map(e => e.english_word).join(', ')}.
            </p>
          )}
          <button
            onClick={() => router.push('/admin/words')}
            className="mt-3 text-sm text-green-700 underline"
          >
            Back to word list
          </button>
        </div>
      )}

      {/* Upload zone or file indicator */}
      {!fileName ? (
        <div
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          className="border-2 border-dashed border-gray-300 rounded-2xl p-10 text-center cursor-pointer hover:border-purple-400 transition"
          onClick={() => fileInputRef.current?.click()}
        >
          <p className="text-gray-500">Drag & drop an Excel file here, or click to browse</p>
          <p className="text-xs text-gray-400 mt-1">.xlsx files only · max {MAX_ROWS} rows</p>
          <input ref={fileInputRef} type="file" accept=".xlsx" className="hidden" onChange={handleInputChange} />
        </div>
      ) : (
        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl mb-4">
          <span className="text-gray-700 font-medium text-sm">{fileName}</span>
          <button
            onClick={() => { setFileName(''); setRows([]); setSaveResult(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
            className="text-sm text-purple-600 underline"
          >
            Change file
          </button>
          <input ref={fileInputRef} type="file" accept=".xlsx" className="hidden" onChange={handleInputChange} />
        </div>
      )}

      {/* Parse error */}
      {parseError && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {parseError}
        </div>
      )}

      {/* Preview table */}
      {rows.length > 0 && !saveResult && (
        <>
          <div className="flex gap-3 mt-5 mb-3">
            <span className="px-3 py-1 rounded-lg bg-green-100 text-green-700 text-sm font-medium">
              ✓ {validRows.length} ready to import
            </span>
            {errorRows.length > 0 && (
              <span className="px-3 py-1 rounded-lg bg-red-100 text-red-700 text-sm font-medium">
                ✗ {errorRows.length} have errors
              </span>
            )}
          </div>

          <div className="overflow-x-auto rounded-2xl shadow-sm border border-gray-100">
            <table className="w-full text-sm bg-white">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="text-left px-3 py-2">#</th>
                  <th className="text-left px-3 py-2">Vocabulary</th>
                  <th className="text-left px-3 py-2">POS</th>
                  <th className="text-left px-3 py-2">Thai Meaning</th>
                  <th className="text-left px-3 py-2">English Example</th>
                  <th className="text-left px-3 py-2">Thai Example</th>
                  <th className="text-left px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.rowNum} className={`border-t ${row.errors.length > 0 ? 'bg-red-50' : ''}`}>
                    <td className="px-3 py-2 text-gray-400">{row.rowNum}</td>
                    <td className="px-3 py-2 font-medium">{row.english_word}</td>
                    <td className="px-3 py-2 text-gray-500">{row.part_of_speech ?? '—'}</td>
                    <td className="px-3 py-2 text-gray-500">{row.thai_translation}</td>
                    <td className="px-3 py-2 text-gray-400 italic">{row.english_example ?? '—'}</td>
                    <td className="px-3 py-2 text-gray-400 italic">{row.thai_example ?? '—'}</td>
                    <td className="px-3 py-2">
                      {row.errors.length === 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs">✓ Ready</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {row.errors.map(err => (
                            <span key={err} className={`px-2 py-0.5 rounded-full text-xs ${STATUS_BADGE[err] ?? 'bg-red-100 text-red-700'}`}>
                              ✗ {err}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center mt-4">
            <p className="text-xs text-gray-400">Rows with errors are skipped. Fix them in Excel and re-upload.</p>
            <div className="flex gap-3">
              <button
                onClick={() => router.push('/admin/words')}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || validRows.length === 0}
                className="px-5 py-2 text-sm font-semibold bg-purple-500 hover:bg-purple-600 text-white rounded-xl disabled:opacity-50 transition"
              >
                {saving ? 'Saving…' : `Save ${validRows.length} valid word${validRows.length !== 1 ? 's' : ''} →`}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Manual verify**

- Visit `/admin/words/import`
- Upload an Excel file with 5 columns (correct headers)
- Verify preview table shows with correct badges
- Include one deliberately missing Thai column — verify red "Missing Thai" badge
- Click "Save X valid words" — confirm Supabase Table Editor shows new rows with `image_url = null`

- [ ] **Step 5: Commit**

```bash
git add app/admin/words/import/page.tsx package.json package-lock.json
git commit -m "feat: add Excel bulk import page with preview and confirm flow"
```

---

## Task 12: No-Image Queue Page

**Files:**
- Create: `app/admin/words/no-image/page.tsx`

- [ ] **Step 1: Create the page**

```typescript
// app/admin/words/no-image/page.tsx
import { createServiceClient } from '@/lib/supabase/service'
import Link from 'next/link'

const PAGE_SIZE = 20

export default async function NoImagePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const params = await searchParams
  const page = Math.max(1, Number(params.page ?? 1))
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const service = createServiceClient()

  const { data: words } = await service
    .from('words')
    .select('id, english_word, thai_translation, part_of_speech, created_at')
    .is('image_url', null)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .range(from, to)

  const isEmpty = !words || words.length === 0

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Words Without Images</h2>

      {isEmpty ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">All words have images.</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="text-left px-4 py-3">English</th>
                  <th className="text-left px-4 py-3">Thai</th>
                  <th className="text-left px-4 py-3">POS</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {words.map(w => (
                  <tr key={w.id} className="border-t">
                    <td className="px-4 py-3 font-medium">{w.english_word}</td>
                    <td className="px-4 py-3 text-gray-500">{w.thai_translation}</td>
                    <td className="px-4 py-3 text-gray-400 italic">{w.part_of_speech ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs">No image</span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/words/${w.id}`}
                        className="text-purple-600 hover:underline text-sm font-medium"
                      >
                        Add Image
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex gap-2 mt-4">
            {page > 1 && (
              <Link
                href={`/admin/words/no-image?page=${page - 1}`}
                className="px-3 py-1 rounded-xl bg-white shadow text-sm text-gray-600"
              >
                ← Prev
              </Link>
            )}
            <span className="text-sm text-gray-400 self-center">Page {page}</span>
            {(words?.length ?? 0) === PAGE_SIZE && (
              <Link
                href={`/admin/words/no-image?page=${page + 1}`}
                className="px-3 py-1 rounded-xl bg-white shadow text-sm text-gray-600"
              >
                Next →
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check + commit**

```bash
npx tsc --noEmit
git add app/admin/words/no-image/page.tsx
git commit -m "feat: add no-image queue page for bulk-imported words"
```

---

## Task 13: Update Admin Navigation

**Files:**
- Modify: `app/admin/words/page.tsx`
- Modify: `app/admin/layout.tsx`

- [ ] **Step 1: Add "Import from Excel" button to words page**

In `app/admin/words/page.tsx`, find the header row:
```tsx
<div className="flex items-center justify-between mb-6">
  <h2 className="text-2xl font-bold text-gray-800">Word Database</h2>
  <Link href="/admin/words/new"
    className="bg-purple-500 hover:bg-purple-600 text-white font-semibold px-4 py-2 rounded-xl transition">
    + Add Word
  </Link>
</div>
```

Replace with:
```tsx
<div className="flex items-center justify-between mb-6">
  <h2 className="text-2xl font-bold text-gray-800">Word Database</h2>
  <div className="flex gap-3">
    <Link href="/admin/words/import"
      className="bg-white border border-purple-300 text-purple-600 font-semibold px-4 py-2 rounded-xl hover:bg-purple-50 transition text-sm">
      Import from Excel
    </Link>
    <Link href="/admin/words/new"
      className="bg-purple-500 hover:bg-purple-600 text-white font-semibold px-4 py-2 rounded-xl transition">
      + Add Word
    </Link>
  </div>
</div>
```

- [ ] **Step 2: Add "No Image" nav link with count badge to admin layout**

In `app/admin/layout.tsx`, the `navLinks` array is defined statically. Because the count badge requires a live DB query, it cannot be in the static `navLinks` array. Instead, add it as a separate server-side query and a dedicated nav item.

At the top of `AdminLayout` server component, after the admin check, add:
```typescript
const { count: noImageCount } = await supabase
  .from('words')
  .select('*', { count: 'exact', head: true })
  .is('image_url', null)
  .eq('is_deleted', false)
```

Then in the sidebar JSX, after the existing nav links, add:
```tsx
<Link
  href="/admin/words/no-image"
  className="px-3 py-2 rounded-xl text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition text-sm font-medium flex items-center justify-between"
>
  <span>🖼 No Image</span>
  {(noImageCount ?? 0) > 0 && (
    <span className="bg-orange-100 text-orange-700 text-xs font-semibold px-2 py-0.5 rounded-full">
      {noImageCount}
    </span>
  )}
</Link>
```

> Note: Use the `service` client (not the user-scoped `supabase` client) for the count query if you encounter RLS issues. The `supabase` client here is the server-side client from `createClient()` which uses the user session and may be blocked by RLS. Swap to `createServiceClient()` if the count comes back null.

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Manual verify**

- Visit `/admin/words` — confirm "Import from Excel" button appears next to "+ Add Word"
- Sidebar — confirm "No Image (N)" link appears with correct count
- Visit `/admin/words/no-image` — confirm it lists words without images

- [ ] **Step 5: Commit**

```bash
git add app/admin/words/page.tsx app/admin/layout.tsx
git commit -m "feat: add Import Excel button and No Image nav link to admin"
```

---

## Task 14: Deploy to Vercel

- [ ] **Step 1: Push to GitHub**

```bash
git push
```

- [ ] **Step 2: Verify Vercel build**

Watch the Vercel dashboard — confirm the build succeeds with no TypeScript or build errors.

- [ ] **Step 3: End-to-end verify on production**

1. Visit `/admin/words/new` — confirm 3 new fields appear
2. Create a word with POS "noun" + examples — play the game and verify back face shows them
3. Visit `/admin/words/import` — upload a valid Excel file, verify preview, save words
4. Visit `/admin/words/no-image` — confirm imported words appear
5. Click "Add Image" on a word, upload an image, save — confirm word disappears from no-image queue
