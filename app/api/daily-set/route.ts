import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { toBangkokDateString } from '@/lib/bangkok-date'
import { NextResponse } from 'next/server'
import type { DailySetResponse } from '@/lib/types'

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

export function buildDailySetResponse(
  setId: string,
  setDate: string,
  rows: SetWordRow[]
): DailySetResponse {
  const words = [...rows].sort((a, b) => a.position - b.position)
  return { set_id: setId, set_date: setDate, words }
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: appUser } = await supabase
    .from('users')
    .select('is_approved')
    .eq('id', user.id)
    .single()

  if (!appUser?.is_approved) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const today = toBangkokDateString()
  const service = createServiceClient()

  const { data: set } = await service
    .from('daily_sets')
    .select('id, set_date')
    .eq('set_date', today)
    .not('published_at', 'is', null)
    .single()

  if (!set) return NextResponse.json({ error: 'No set today' }, { status: 404 })

  const { data: words, error } = await service
    .from('daily_set_words')
    .select(`
      word_id,
      position,
      words ( english_word, thai_translation, image_url, audio_url, part_of_speech, english_example, thai_example )
    `)
    .eq('set_id', set.id)

  if (error || !words) {
    return NextResponse.json({ error: 'Failed to load words' }, { status: 500 })
  }

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

  return NextResponse.json(buildDailySetResponse(set.id, set.set_date, rows))
}
