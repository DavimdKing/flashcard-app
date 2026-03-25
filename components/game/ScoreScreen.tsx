'use client'

import { useEffect } from 'react'
import type { DailySetResponse, ProgressResult } from '@/lib/types'

interface Props {
  words: DailySetResponse['words']
  results: ProgressResult[]
  onPlayAgain: () => void
}

export default function ScoreScreen({ words, results, onPlayAgain }: Props) {
  const gotIt = results.filter(r => r.result === 'got_it').length
  const total = words.length

  useEffect(() => {
    if (gotIt >= 7) {
      import('canvas-confetti').then(m => m.default({ particleCount: 150, spread: 70 }))
    }
  }, [gotIt])

  const resultMap = new Map(results.map(r => [r.word_id, r.result]))

  return (
    <div className="flex flex-col items-center gap-6 py-8 px-4 w-full max-w-[420px] mx-auto">
      <div className="bg-white rounded-3xl shadow-lg p-8 w-full flex flex-col items-center gap-2">
        <span className="text-5xl">{gotIt >= 7 ? '🎉' : '💪'}</span>
        <h2 className="text-3xl font-bold text-purple-700">{gotIt} / {total}</h2>
        <p className="text-gray-500 text-sm">
          {gotIt >= 7 ? 'Amazing work!' : 'Keep practising!'}
        </p>
      </div>

      <div className="bg-white rounded-3xl shadow p-4 w-full flex flex-col gap-2">
        {words.map(w => {
          const result = resultMap.get(w.word_id)
          return (
            <div key={w.word_id} className="flex items-center justify-between py-2 border-b last:border-0">
              <div>
                <span className="font-medium text-gray-800">{w.english_word}</span>
                <span className="text-gray-400 text-sm ml-2">{w.thai_translation}</span>
              </div>
              <span>{result === 'got_it' ? '✅' : result === 'nope' ? '❌' : '–'}</span>
            </div>
          )
        })}
      </div>

      <button
        type="button"
        onClick={onPlayAgain}
        className="w-full bg-purple-500 hover:bg-purple-600 text-white font-bold py-4 rounded-2xl text-lg transition"
      >
        🔄 Play Again
      </button>
    </div>
  )
}
