'use client'

import { useRouter } from 'next/navigation'
import CardStack from '@/components/game/CardStack'
import type { DailySetResponse, MistakeWord } from '@/lib/types'

interface RetakeWord {
  word_id: string
  english_word: string
}

interface Props {
  words: MistakeWord[]
}

export default function MistakeRetakePlay({ words }: Props) {
  const router = useRouter()

  const retakeSet: DailySetResponse = {
    set_id: 'retake',
    set_date: new Date().toISOString().split('T')[0],
    words: words.map((w, idx) => ({
      word_id: w.word_id,
      position: idx + 1,
      english_word: w.english_word,
      thai_translation: w.thai_translation,
      image_url: w.image_url,
      audio_url: w.audio_url,
      part_of_speech: w.part_of_speech,
      english_example: w.english_example,
      thai_example: w.thai_example,
    })),
  }

  const handleRetakeComplete = (gotItWordIds: string[], nopeWordIds: string[]) => {
    const toWord = (id: string): RetakeWord => {
      const w = words.find(x => x.word_id === id)!
      return { word_id: id, english_word: w.english_word }
    }
    const payload = {
      gotItWords: gotItWordIds.map(toWord),
      nopeWords:  nopeWordIds.map(toWord),
    }
    sessionStorage.setItem('retake_results', JSON.stringify(payload))
    router.push('/mistake-words/retake/score')
  }

  return (
    <CardStack
      initialSet={retakeSet}
      initialProgress={[]}
      mode="retake"
      onRetakeComplete={handleRetakeComplete}
    />
  )
}
