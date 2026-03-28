import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function requireApprovedUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, supabase, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: appUser } = await supabase.from('users').select('is_approved').eq('id', user.id).single()
  if (!appUser?.is_approved) return { user: null, supabase, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { user, supabase, error: null }
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

  await supabase
    .from('mistake_words')
    .upsert({ user_id: user!.id, word_id }, { onConflict: 'user_id,word_id', ignoreDuplicates: true })

  return NextResponse.json({ ok: true })
}
