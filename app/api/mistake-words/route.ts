import { NextResponse } from 'next/server'
import { requireApprovedUser, UUID_RE } from './_auth'

interface Row {
  word_id: string
  created_at: string
  words: {
    english_word: string
    part_of_speech: string | null
    thai_translation: string
    english_example: string | null
    thai_example: string | null
    image_url: string | null
    audio_url: string | null
  } | null
}

export async function GET() {
  const { user, supabase, error } = await requireApprovedUser()
  if (error) return error

  const { data, error: dbError } = await supabase
    .from('mistake_words')
    .select(`
      word_id,
      created_at,
      words (
        english_word,
        part_of_speech,
        thai_translation,
        english_example,
        thai_example,
        image_url,
        audio_url
      )
    `)
    .order('created_at', { ascending: false })

  if (dbError) return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })

  const result = ((data ?? []) as unknown as Row[])
    .filter(r => r.words !== null)
    .map(r => ({
      word_id: r.word_id,
      english_word: r.words!.english_word,
      part_of_speech: r.words!.part_of_speech,
      thai_translation: r.words!.thai_translation,
      english_example: r.words!.english_example,
      thai_example: r.words!.thai_example,
      image_url: r.words!.image_url,
      audio_url: r.words!.audio_url,
      created_at: r.created_at,
    }))

  return NextResponse.json(result)
}

export async function POST(request: Request) {
  const { user, supabase, error } = await requireApprovedUser()
  if (error) return error

  const body = await request.json().catch(() => null)
  const { word_id } = (body ?? {}) as Record<string, unknown>

  if (typeof word_id !== 'string' || !UUID_RE.test(word_id)) {
    return NextResponse.json({ error: 'Invalid word_id' }, { status: 400 })
  }

  // Verify word exists and is not deleted
  const { data: word } = await supabase
    .from('words').select('id').eq('id', word_id).eq('is_deleted', false).single()
  if (!word) return NextResponse.json({ error: 'Word not found' }, { status: 404 })

  const { error: upsertError } = await supabase
    .from('mistake_words')
    .upsert({ user_id: user!.id, word_id }, { onConflict: 'user_id,word_id', ignoreDuplicates: true })
  if (upsertError) return NextResponse.json({ error: 'Failed to save' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
