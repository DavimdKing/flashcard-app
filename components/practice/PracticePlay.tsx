'use client'

import { useRouter } from 'next/navigation'
import CardStack from '@/components/game/CardStack'
import type { DailySetResponse } from '@/lib/types'

interface Props {
  groupId: string
  practiceSet: DailySetResponse
}

export default function PracticePlay({ groupId, practiceSet }: Props) {
  const router = useRouter()

  const handleSessionComplete = async (scorePct: number) => {
    try {
      const res = await fetch('/api/practice/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: groupId, score_pct: scorePct }),
      })
      if (res.ok) {
        const { best_score, is_new_best } = await res.json()
        router.push(`/practice/${groupId}/score?pct=${scorePct}&best=${best_score}&new=${is_new_best ? 1 : 0}`)
      } else {
        router.push(`/practice/${groupId}/score?pct=${scorePct}&best=${scorePct}&new=0`)
      }
    } catch {
      router.push(`/practice/${groupId}/score?pct=${scorePct}&best=${scorePct}&new=0`)
    }
  }

  return (
    <CardStack
      initialSet={practiceSet}
      initialProgress={[]}
      mode="practice"
      onSessionComplete={handleSessionComplete}
    />
  )
}
