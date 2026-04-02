'use client'

import { useState, useCallback, useRef } from 'react'
import SoundButton from '@/components/ui/SoundButton'
import type { MultipleChoiceWord } from '@/lib/types'

interface Props {
  word: MultipleChoiceWord
  bgGradient: string
  onSubmit: (correct: boolean) => void
  onSwipeNext: () => void
}

export default function MultipleChoiceCard({ word, bgGradient, onSubmit, onSwipeNext }: Props) {
  const [isFlipped, setIsFlipped] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [ignoreClicks, setIgnoreClicks] = useState(false)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const mouseStartRef = useRef<{ x: number; y: number } | null>(null)

  const handleSubmit = useCallback(() => {
    if (!selected || submitted || ignoreClicks) return
    setSubmitted(true)
    setIgnoreClicks(true)
    setIsFlipped(true)
    onSubmit(selected === word.thai_translation)
    setTimeout(() => setIgnoreClicks(false), 500)
  }, [selected, submitted, ignoreClicks, word.thai_translation, onSubmit])

  const handleFlipBack = useCallback(() => {
    if (!isFlipped || ignoreClicks) return
    setIsFlipped(false)
    setIgnoreClicks(true)
    setTimeout(() => setIgnoreClicks(false), 500)
  }, [isFlipped, ignoreClicks])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current || ignoreClicks) { touchStartRef.current = null; return }
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y
    touchStartRef.current = null
    if (Math.abs(dx) < 50 || Math.abs(dx) <= Math.abs(dy)) return
    if (dx < 0 && isFlipped) onSwipeNext()
    else if (dx > 0 && isFlipped) handleFlipBack()
    else if (dx < 0 && submitted) { setIgnoreClicks(true); setIsFlipped(true); setTimeout(() => setIgnoreClicks(false), 500) }
    // swipe right on front face: no-op
  }, [ignoreClicks, isFlipped, submitted, onSwipeNext, handleFlipBack])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    mouseStartRef.current = { x: e.clientX, y: e.clientY }
  }, [])

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (!mouseStartRef.current || ignoreClicks) { mouseStartRef.current = null; return }
    const dx = e.clientX - mouseStartRef.current.x
    const dy = e.clientY - mouseStartRef.current.y
    mouseStartRef.current = null
    if (Math.abs(dx) < 50 || Math.abs(dx) <= Math.abs(dy)) return
    if (dx < 0 && isFlipped) onSwipeNext()
    else if (dx > 0 && isFlipped) handleFlipBack()
    else if (dx < 0 && submitted) { setIgnoreClicks(true); setIsFlipped(true); setTimeout(() => setIgnoreClicks(false), 500) }
  }, [ignoreClicks, isFlipped, submitted, onSwipeNext, handleFlipBack])

  const isCorrect = submitted && selected === word.thai_translation
  const imgVisible = isFlipped ? '' : 'opacity-0 pointer-events-none'

  return (
    <div
      data-testid="mc-card-container"
      className="relative w-full max-w-[420px] mx-auto"
      style={{ perspective: '1000px' }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      {/* Flip-back button — rendered outside 3D transform */}
      <button
        onClick={handleFlipBack}
        className="absolute top-3 right-3 z-10 bg-white/20 hover:bg-white/30 text-white text-xs font-medium px-2 py-1 rounded-full transition"
        style={{ opacity: isFlipped ? 1 : 0, pointerEvents: isFlipped ? 'auto' : 'none' }}
        aria-label="Flip back to question"
      >
        &#x21A9; flip
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
          className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${bgGradient} flex flex-col p-5 select-none shadow-xl`}
          style={{ backfaceVisibility: 'hidden' }}
          aria-hidden={isFlipped}
        >
          <div className="absolute top-4 left-4">
            <SoundButton audioUrl={word.audio_url} />
          </div>

          <div className="flex-1 flex items-center justify-center pt-8">
            <h2 className="text-4xl font-bold text-white drop-shadow text-center">{word.english_word}</h2>
          </div>

          <div className="flex flex-col gap-2 mb-3">
            {word.choices.map((choice) => (
              <button
                key={choice}
                onClick={() => setSelected(choice)}
                disabled={submitted}
                className={`w-full py-3 px-4 rounded-2xl text-center text-sm font-semibold transition border-2 ${
                  selected === choice
                    ? 'bg-white text-purple-700 border-white'
                    : 'bg-white/25 text-white border-white/40'
                }`}
              >
                {choice}
              </button>
            ))}
          </div>

          <button
            onClick={handleSubmit}
            disabled={!selected || submitted}
            aria-label="Submit answer"
            className={`w-full py-3 rounded-2xl text-sm font-bold transition ${
              selected && !submitted
                ? 'bg-purple-600 text-white hover:bg-purple-700'
                : 'bg-gray-400/50 text-white/50 cursor-not-allowed'
            }`}
          >
            Submit &#x2192;
          </button>
        </div>

        {/* Back face */}
        <div
          className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${bgGradient} flex flex-col items-center justify-center gap-3 p-6 shadow-xl overflow-y-auto`}
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', visibility: isFlipped ? 'visible' : 'hidden' }}
          aria-hidden={!isFlipped}
        >
          {submitted && (
            <>
              <div className="absolute top-4 left-4">
                <SoundButton audioUrl={word.audio_url} />
              </div>

              <div className={`px-4 py-1.5 rounded-xl text-sm font-bold border-2 text-center ${
                isCorrect
                  ? 'bg-green-100 text-green-700 border-green-300'
                  : 'bg-yellow-50 text-yellow-800 border-yellow-300'
              }`}>
                {isCorrect ? 'Correct!' : `Wrong — correct: ${word.thai_translation}`}
              </div>

              <h2 className="text-4xl font-bold text-white drop-shadow text-center">{word.thai_translation}</h2>

              {word.part_of_speech && (
                <p className="text-sm font-semibold text-gray-700 tracking-wide uppercase">{word.part_of_speech}</p>
              )}

              {word.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={word.image_url}
                  alt={word.thai_translation}
                  className={`w-48 h-48 object-contain rounded-2xl ${imgVisible}`}
                />
              ) : (
                <div className={`w-48 h-48 bg-white/10 rounded-2xl ${imgVisible}`} />
              )}

              {word.english_example && (
                <p className="text-sm text-gray-800 font-medium text-center px-2 leading-relaxed">{word.english_example}</p>
              )}

              {word.english_example && word.thai_example && (
                <div className="w-10 h-px bg-gray-400/50" />
              )}
              {word.thai_example && (
                <p className="text-sm text-gray-800 font-medium text-center px-2 leading-relaxed">{word.thai_example}</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
