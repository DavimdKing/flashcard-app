'use client'

import { useRouter } from 'next/navigation'
import MultipleChoiceStack from './MultipleChoiceStack'
import type { MultipleChoiceWord } from '@/lib/types'

export default function DailyPlay({ words, setId }: { words: MultipleChoiceWord[]; setId: string }) {
  const router = useRouter()
  return (
    <MultipleChoiceStack
      words={words}
      mode="daily"
      setId={setId}
      onSessionComplete={() => router.push('/dashboard')}
    />
  )
}
