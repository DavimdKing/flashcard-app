import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { toBangkokDateString } from '@/lib/bangkok-date'
import { buildMultipleChoiceWords } from '@/lib/distractors'
import { redirect } from 'next/navigation'
import DailyPlay from '@/components/game/DailyPlay'

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

  const sessionWords = (wordRows ?? [])
    .filter((w: any) => w.words != null)
    .map((w: any) => ({
      word_id: w.word_id,
      english_word: w.words.english_word,
      thai_translation: w.words.thai_translation,
      image_url: w.words.image_url,
      audio_url: w.words.audio_url,
      part_of_speech: w.words.part_of_speech ?? null,
      english_example: w.words.english_example ?? null,
      thai_example: w.words.thai_example ?? null,
    }))
    .sort((a: any, b: any) => a.position - b.position)

  if (sessionWords.length === 0) redirect('/no-set')

  const sessionWordIds = sessionWords.map((w: any) => w.word_id)
  const { data: poolRows } = await service
    .from('words')
    .select('thai_translation')
    .not('id', 'in', `(${sessionWordIds.join(',')})`)
    .eq('is_deleted', false)
    .order('id', { ascending: false })
    .limit(sessionWordIds.length * 4)

  const pool = (poolRows ?? []).map((r: { thai_translation: string }) => r.thai_translation)

  if (pool.length === 0) redirect('/no-set')

  const words = buildMultipleChoiceWords(sessionWords, pool)

  return (
    <main className="flex flex-col items-center pt-2">
      <DailyPlay words={words} setId={set.id} />
    </main>
  )
}
