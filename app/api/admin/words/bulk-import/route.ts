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
  const batchInserted = new Set<string>()

  for (const word of words) {
    const wordLower = word.english_word.toLowerCase()

    if (existingLower.has(wordLower) || batchInserted.has(wordLower)) {
      errors.push({ english_word: word.english_word, reason: 'Duplicate word' })
      continue
    }

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
      existingLower.add(wordLower)
    }
  }

  return NextResponse.json({ saved, audio_failures: audioFailures, errors })
}
