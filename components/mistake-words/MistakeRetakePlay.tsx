'use client'

import { useRouter } from 'next/navigation'
import MultipleChoiceStack from '@/components/game/MultipleChoiceStack'
import type { MultipleChoiceWord } from '@/lib/types'

interface RetakeWord {
  word_id: string
  english_word: string
}

interface Props {
  words: MultipleChoiceWord[]
}

export default function MistakeRetakePlay({ words }: Props) {
  const router = useRouter()

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
    <MultipleChoiceStack
      words={words}
      mode="retake"
      onRetakeComplete={handleRetakeComplete}
    />
  )
}
