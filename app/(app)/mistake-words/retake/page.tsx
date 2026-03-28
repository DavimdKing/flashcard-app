import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MistakeRetakePlay from '@/components/mistake-words/MistakeRetakePlay'
import type { MistakeWord } from '@/lib/types'

function fisherYates<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export const dynamic = 'force-dynamic'

export default async function MistakeRetakePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: appUser } = await supabase
    .from('users').select('is_approved').eq('id', user.id).single()
  if (!appUser?.is_approved) redirect('/access-denied')

  const { data } = await supabase
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

  const allWords: MistakeWord[] = ((data ?? []) as unknown as Row[])
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

  // Guard: need at least 2 words to retake
  if (allWords.length < 2) redirect('/mistake-words')

  const words = fisherYates(allWords).slice(0, 20)

  return (
    <main className="flex flex-col items-center pt-2">
      <MistakeRetakePlay words={words} />
    </main>
  )
}
