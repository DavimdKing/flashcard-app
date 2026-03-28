'use client'

import Link from 'next/link'
import type { MistakeWord } from '@/lib/types'

interface Props {
  words: MistakeWord[]
}

export default function MistakeWordsClient({ words }: Props) {
  const retakeCount = Math.min(words.length, 20)
  const canRetake = words.length >= 2

  return (
    <div>
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-800">😢 Mistake Words</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {words.length} word{words.length !== 1 ? 's' : ''} to review
          </p>
        </div>
        <Link
          href="/mistake-words/retake"
          aria-disabled={!canRetake}
          tabIndex={canRetake ? undefined : -1}
          className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition shrink-0 ${
            canRetake
              ? 'bg-purple-600 text-white hover:bg-purple-700'
              : 'bg-gray-200 text-gray-400 pointer-events-none'
          }`}
        >
          Retake ({retakeCount})
        </Link>
      </div>

      {words.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">🎉</p>
          <p className="font-medium">No mistakes yet — keep it up!</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {words.map(w => (
          <div key={w.word_id} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-base font-bold text-gray-800">{w.english_word}</span>
              {w.part_of_speech && (
                <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                  {w.part_of_speech}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-700 mb-1">{w.thai_translation}</p>
            {(w.english_example || w.thai_example) && (
              <p className="text-xs text-gray-400 italic">
                {[w.english_example, w.thai_example].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
