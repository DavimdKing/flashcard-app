'use client'

import { useRouter } from 'next/navigation'
import MultipleChoiceStack from './MultipleChoiceStack'
import type { MultipleChoiceWord } from '@/lib/types'

export default function DailyPlay({ words }: { words: MultipleChoiceWord[] }) {
  const router = useRouter()
  return (
    <MultipleChoiceStack
      words={words}
      mode="daily"
      onSessionComplete={() => router.push('/dashboard')}
    />
  )
}
