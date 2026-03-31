'use client'

import { useState, useCallback, useRef } from 'react'
import SoundButton from '@/components/ui/SoundButton'
import type { DailySetResponse } from '@/lib/types'

type WordData = DailySetResponse['words'][number]

interface Props {
  word: WordData
  onFlipped: () => void
  onFlipBack: () => void
  onSwipeGotIt: () => void
  bgGradient: string
}

export default function FlashCard({ word, onFlipped, onFlipBack, onSwipeGotIt, bgGradient }: Props) {
  const [isFlipped, setIsFlipped] = useState(false)
  const [ignoreClicks, setIgnoreClicks] = useState(false)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const mouseStartRef = useRef<{ x: number; y: number } | null>(null)

  const handleCardClick = useCallback(() => {
    if (isFlipped || ignoreClicks) return
    setIsFlipped(true)
    setIgnoreClicks(true)
    onFlipped()
    setTimeout(() => setIgnoreClicks(false), 500)
  }, [isFlipped, ignoreClicks, onFlipped])

  const handleFlipBack = useCallback(() => {
    setIsFlipped(false)
    setIgnoreClicks(true)
    onFlipBack()
    setTimeout(() => setIgnoreClicks(false), 500)
  }, [onFlipBack])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current || ignoreClicks) { touchStartRef.current = null; return }
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y
    touchStartRef.current = null
    if (Math.abs(dx) < 50 || Math.abs(dx) <= Math.abs(dy)) return
    if (dx < 0) {
      if (!isFlipped) handleCardClick()
      else onSwipeGotIt()
    } else if (isFlipped) {
      handleFlipBack()
    }
  }, [ignoreClicks, isFlipped, handleCardClick, onSwipeGotIt, handleFlipBack])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    mouseStartRef.current = { x: e.clientX, y: e.clientY }
  }, [])

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (!mouseStartRef.current || ignoreClicks) { mouseStartRef.current = null; return }
    const dx = e.clientX - mouseStartRef.current.x
    const dy = e.clientY - mouseStartRef.current.y
    mouseStartRef.current = null
    if (Math.abs(dx) < 50 || Math.abs(dx) <= Math.abs(dy)) return
    if (dx < 0) {
      if (!isFlipped) handleCardClick()
      else onSwipeGotIt()
    } else if (isFlipped) {
      handleFlipBack()
    }
  }, [ignoreClicks, isFlipped, handleCardClick, onSwipeGotIt, handleFlipBack])

  const imgVisible = isFlipped ? '' : 'opacity-0 pointer-events-none'

  return (
    <div
      data-testid="card-container"
      className="relative w-full max-w-[420px] mx-auto"
      style={{ perspective: '1000px' }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      {/* Flip-back button — rendered outside the 3D transform so visibility is CSS-only */}
      <button
        onClick={handleFlipBack}
        className="absolute top-3 right-3 z-10 bg-white/20 hover:bg-white/30 text-white text-xs font-medium px-2 py-1 rounded-full transition"
        style={{ opacity: isFlipped ? 1 : 0, pointerEvents: isFlipped ? 'auto' : 'none' }}
        aria-label="Flip back to question"
      >
        ↩ flip
      </button>
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
          className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${bgGradient} flex flex-col items-center justify-center gap-3 p-6 shadow-xl`}
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', visibility: isFlipped ? 'visible' : 'hidden' }}
        >
          <div className="absolute top-4 left-4">
            <SoundButton audioUrl={word.audio_url} />
          </div>

          {/* Thai word */}
          <h2 className="text-4xl font-bold text-white drop-shadow text-center">{word.thai_translation}</h2>

          {/* Part of speech */}
          {word.part_of_speech && (
            <p className="text-sm font-semibold text-gray-700 tracking-wide uppercase">{word.part_of_speech}</p>
          )}

          {/* Image or placeholder */}
          {word.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={word.image_url}
              alt={word.thai_translation}
              className={`w-80 h-80 object-contain rounded-2xl ${imgVisible}`}
            />
          ) : (
            <div className={`w-80 h-80 bg-white/10 rounded-2xl ${imgVisible}`} />
          )}

          {/* Example sentences */}
          {word.english_example && (
            <p className="text-sm text-gray-800 font-medium text-center px-2 leading-relaxed">{word.english_example}</p>
          )}
          {word.english_example && word.thai_example && (
            <div className="w-10 h-px bg-gray-400/50" />
          )}
          {word.thai_example && (
            <p className="text-sm text-gray-800 font-medium text-center px-2 leading-relaxed">{word.thai_example}</p>
          )}
        </div>
      </div>
    </div>
  )
}
