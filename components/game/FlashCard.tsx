'use client'

import { useState, useCallback } from 'react'
import SoundButton from '@/components/ui/SoundButton'
import type { DailySetResponse } from '@/lib/types'

type WordData = DailySetResponse['words'][number]

interface Props {
  word: WordData
  onFlipped: () => void
  bgGradient: string
}

export default function FlashCard({ word, onFlipped, bgGradient }: Props) {
  const [isFlipped, setIsFlipped] = useState(false)
  const [ignoreClicks, setIgnoreClicks] = useState(false)

  const handleCardClick = useCallback(() => {
    if (isFlipped || ignoreClicks) return
    setIsFlipped(true)
    setIgnoreClicks(true)
    onFlipped()
    setTimeout(() => setIgnoreClicks(false), 500)
  }, [isFlipped, ignoreClicks, onFlipped])

  const imgAnimation = isFlipped ? 'animate-bounce [animation-iteration-count:1]' : 'opacity-0'

  return (
    <div
      className="relative w-full max-w-[420px] mx-auto"
      style={{ perspective: '1000px' }}
    >
      <div
        className="relative w-full"
        style={{
          transformStyle: 'preserve-3d',
          transition: 'transform 0.6s ease',
          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          aspectRatio: '3/4',
        }}
      >
        {/* Front face */}
        <div
          data-testid="card-body"
          onClick={handleCardClick}
          className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${bgGradient} flex flex-col p-5 cursor-pointer select-none shadow-xl`}
          style={{ backfaceVisibility: 'hidden' }}
        >
          <div className="absolute top-4 left-4">
            <SoundButton audioUrl={word.audio_url} />
          </div>
          <div className="flex-1 flex items-center justify-center">
            <h2 className="text-4xl font-bold text-white drop-shadow text-center">
              {word.english_word}
            </h2>
          </div>
          <p className="text-center text-white/70 text-sm">Tap to reveal ✨</p>
        </div>

        {/* Back face */}
        <div
          className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${bgGradient} flex flex-col items-center justify-center gap-4 p-6 shadow-xl`}
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', visibility: isFlipped ? 'visible' : 'hidden' }}
        >
          <div className="absolute top-4 left-4">
            <SoundButton audioUrl={word.audio_url} />
          </div>
          <h2 className="text-4xl font-bold text-white drop-shadow">{word.thai_translation}</h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={word.image_url}
            alt={word.thai_translation}
            className={`w-40 h-40 object-contain rounded-2xl ${imgAnimation}`}
          />
        </div>
      </div>
    </div>
  )
}
