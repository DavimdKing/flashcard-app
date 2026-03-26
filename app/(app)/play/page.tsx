import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { toBangkokDateString } from '@/lib/bangkok-date'
import { redirect } from 'next/navigation'
import CardStack from '@/components/game/CardStack'
import type { DailySetResponse, ProgressResult } from '@/lib/types'

export default async function PlayPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const service = createServiceClient()
  const today = toBangkokDateString()

  const { data: appUser } = await supabase
    .from('users').select('is_approved').eq('id', user.id).single()
  if (!appUser?.is_approved) redirect('/access-denied')

  const { data: set } = await service
    .from('daily_sets')
    .select('id, set_date')
    .eq('set_date', today)
    .not('published_at', 'is', null)
    .single()

  if (!set) redirect('/no-set')

  const { data: wordRows } = await service
    .from('daily_set_words')
    .select('word_id, position, words(english_word, thai_translation, image_url, audio_url, part_of_speech, english_example, thai_example)')
    .eq('set_id', set.id)

  const words = (wordRows ?? [])
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
    .sort((a: any, b: any) => a.position - b.position)

  const dailySet: DailySetResponse = { set_id: set.id, set_date: set.set_date, words }

  const { data: progressRows } = await service
    .from('user_progress')
    .select('word_id, result')
    .eq('user_id', user.id)
    .eq('set_id', set.id)

  const initialProgress: ProgressResult[] = (progressRows ?? []).map((p: any) => ({
    word_id: p.word_id,
    result: p.result,
  }))

  return (
    <main className="flex flex-col items-center pt-2">
      <CardStack initialSet={dailySet} initialProgress={initialProgress} />
    </main>
  )
}
