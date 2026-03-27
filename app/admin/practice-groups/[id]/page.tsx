import { createServiceClient } from '@/lib/supabase/service'
import { notFound } from 'next/navigation'
import PracticeGroupEditForm from './PracticeGroupEditForm'

export const dynamic = 'force-dynamic'

interface WordRow {
  position: number
  words: {
    id: string
    english_word: string
    thai_translation: string
  } | null
}

export default async function EditPracticeGroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const service = createServiceClient()

  const { data: group } = await service
    .from('practice_groups').select('id, name, icon, is_active').eq('id', id).single()
  if (!group) notFound()

  const { data: wordRows } = await service
    .from('practice_group_words')
    .select('position, words(id, english_word, thai_translation)')
    .eq('group_id', id)
    .order('position')

  const currentWords = ((wordRows ?? []) as unknown as WordRow[])
    .filter(r => r.words !== null)
    .map(r => ({
      id: r.words!.id,
      english_word: r.words!.english_word,
      thai_translation: r.words!.thai_translation,
    }))

  return <PracticeGroupEditForm group={group} initialWords={currentWords} />
}
