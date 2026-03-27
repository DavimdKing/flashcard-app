import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { toBangkokDateString } from '@/lib/bangkok-date'
import PracticePlay from '@/components/practice/PracticePlay'
import type { DailySetResponse } from '@/lib/types'

function fisherYates<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export const dynamic = 'force-dynamic'

export default async function PracticePlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: appUser } = await supabase
    .from('users').select('is_approved').eq('id', user.id).single()
  if (!appUser?.is_approved) redirect('/access-denied')

  const service = createServiceClient()

  const { data: group } = await service
    .from('practice_groups').select('id, name').eq('id', id).eq('is_active', true).single()
  if (!group) redirect('/practice')

  const { data: wordRows } = await service
    .from('practice_group_words')
    .select('position, words(id, english_word, thai_translation, image_url, audio_url, part_of_speech, english_example, thai_example)')
    .eq('group_id', id)
    .order('position')

  interface WordRow {
    position: number
    words: {
      id: string
      english_word: string
      thai_translation: string
      image_url: string | null
      audio_url: string | null
      part_of_speech: string | null
      english_example: string | null
      thai_example: string | null
    } | null
  }

  const words = fisherYates(
    ((wordRows ?? []) as unknown as WordRow[])
      .filter(r => r.words !== null)
      .map((r, idx) => ({
        word_id: r.words!.id,
        position: idx + 1,
        english_word: r.words!.english_word,
        thai_translation: r.words!.thai_translation,
        image_url: r.words!.image_url,
        audio_url: r.words!.audio_url,
        part_of_speech: r.words!.part_of_speech ?? null,
        english_example: r.words!.english_example ?? null,
        thai_example: r.words!.thai_example ?? null,
      }))
  )

  const practiceSet: DailySetResponse = {
    set_id: id,
    set_date: toBangkokDateString(),
    words,
  }

  return (
    <main className="flex flex-col items-center pt-2">
      <PracticePlay groupId={id} practiceSet={practiceSet} />
    </main>
  )
}
