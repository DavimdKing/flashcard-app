'use client'

import { useState, useEffect, useRef } from 'react'
import MultipleChoiceCard from './MultipleChoiceCard'
import GameLoadingScreen from './GameLoadingScreen'
import type { MultipleChoiceWord, ProgressResult } from '@/lib/types'

const GRADIENTS = [
  'from-pink-300 to-purple-300',
  'from-teal-200 to-cyan-300',
  'from-yellow-200 to-orange-200',
  'from-blue-200 to-indigo-300',
  'from-green-200 to-teal-200',
  'from-rose-200 to-pink-300',
  'from-purple-200 to-pink-200',
  'from-amber-200 to-yellow-200',
  'from-sky-200 to-blue-200',
  'from-violet-200 to-purple-300',
]

type Props =
  | {
      words: MultipleChoiceWord[]
      mode: 'practice'
      onSessionComplete: (scorePct: number) => void
      onRetakeComplete?: never
    }
  | {
      words: MultipleChoiceWord[]
      mode: 'retake'
      onRetakeComplete: (gotItWordIds: string[], nopeWordIds: string[]) => void
      onSessionComplete?: never
    }

export default function MultipleChoiceStack({ words, mode, onSessionComplete, onRetakeComplete }: Props) {
  const total = words.length
  const [currentIdx, setCurrentIdx] = useState(0)
  const [results, setResults] = useState<ProgressResult[]>([])
  const completedRef = useRef(false)

  // Practice mode completion — identical pattern to CardStack
  useEffect(() => {
    if (mode !== 'practice' || currentIdx < total || completedRef.current) return
    completedRef.current = true
    const gotItCount = results.filter(r => r.result === 'got_it').length
    const scorePct = Math.round(gotItCount / total * 100)
    onSessionComplete?.(scorePct)
  }, [currentIdx, total, mode, results, onSessionComplete])

  // Retake mode completion
  useEffect(() => {
    if (mode !== 'retake' || currentIdx < total || completedRef.current) return
    completedRef.current = true
    const gotItWordIds = results.filter(r => r.result === 'got_it').map(r => r.word_id)
    const nopeWordIds  = results.filter(r => r.result === 'nope').map(r => r.word_id)
    onRetakeComplete?.(gotItWordIds, nopeWordIds)
  }, [currentIdx, total, mode, results, onRetakeComplete])

  const handleSubmit = (correct: boolean) => {
    const word = words[currentIdx]
    if (!word) return

    setResults(prev => [...prev, { word_id: word.word_id, result: correct ? 'got_it' : 'nope' }])

    if (mode === 'practice' && !correct) {
      fetch('/api/mistake-words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word_id: word.word_id }),
      }).catch(err => console.error('[MultipleChoiceStack] Failed to record mistake word:', err))
    }

    if (mode === 'retake' && correct) {
      fetch(`/api/mistake-words/${word.word_id}`, {
        method: 'DELETE',
      }).catch(err => console.error('[MultipleChoiceStack] Failed to remove mistake word:', err))
    }
  }

  if (currentIdx >= total) return <GameLoadingScreen />

  const currentWord = words[currentIdx]

  return (
    <div className="flex flex-col items-center px-4 pb-10 w-full">
      <div className="w-full max-w-[420px] flex items-center gap-2 mb-4">
        <div className="flex-1 h-2 bg-purple-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-purple-400 rounded-full transition-all"
            style={{ width: `${(currentIdx / total) * 100}%` }}
          />
        </div>
        <span className="text-sm text-purple-400 font-medium">{currentIdx}/{total}</span>
      </div>

      <MultipleChoiceCard
        key={currentWord.word_id}
        word={currentWord}
        bgGradient={GRADIENTS[currentIdx % GRADIENTS.length]}
        onSubmit={handleSubmit}
        onSwipeNext={() => setCurrentIdx(i => i + 1)}
      />
    </div>
  )
}
