'use client'

import { useRouter } from 'next/navigation'
import CardStack from '@/components/game/CardStack'
import type { DailySetResponse } from '@/lib/types'

interface Props {
  practiceSet: DailySetResponse
}

export default function MistakeRetakePlay({ practiceSet }: Props) {
  const router = useRouter()

  const handleRetakeComplete = (gotItWordIds: string[], nopeWordIds: string[]) => {
    const toWord = (id: string) => {
      const w = practiceSet.words.find(x => x.word_id === id)!
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
      initialSet={practiceSet}
      initialProgress={[]}
      mode="retake"
      onRetakeComplete={handleRetakeComplete}
    />
  )
}
