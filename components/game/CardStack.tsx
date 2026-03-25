'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import FlashCard from './FlashCard'
import SelfGradeBar from './SelfGradeBar'
import ScoreScreen from './ScoreScreen'
import GameLoadingScreen from './GameLoadingScreen'
import type { DailySetResponse, ProgressResult, GradeResult } from '@/lib/types'

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

interface Props {
  initialSet: DailySetResponse
  initialProgress: ProgressResult[]
}

export default function CardStack({ initialSet, initialProgress }: Props) {
  const { words, set_id } = initialSet
  const total = words.length

  const gradedSet = new Set(initialProgress.map(p => p.word_id))
  const firstUngraded = words.findIndex(w => !gradedSet.has(w.word_id))
  const startIdx = firstUngraded === -1 ? 0 : firstUngraded
  const showScore = firstUngraded === -1 && initialProgress.length === total

  const [currentIdx, setCurrentIdx] = useState(showScore ? total : startIdx)
  const [showGradeBar, setShowGradeBar] = useState(false)
  const [results, setResults] = useState<ProgressResult[]>(initialProgress)
  const [saving, setSaving] = useState(false)
  const [preloading, setPreloading] = useState(true)
  const gradeBarTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Preload all images and audio before showing first card (8-second timeout)
  useEffect(() => {
    if (showScore) { setPreloading(false); return }
    const timeout = setTimeout(() => setPreloading(false), 8000)
    let loaded = 0
    const assetCount = words.length * 2
    const checkDone = () => { if (++loaded >= assetCount) { clearTimeout(timeout); setPreloading(false) } }
    words.forEach(w => {
      const img = new Image(); img.onload = img.onerror = checkDone; img.src = w.image_url
      if (w.audio_url) {
        const audio = new Audio(); audio.oncanplaythrough = audio.onerror = checkDone; audio.src = w.audio_url
      } else { checkDone() }
    })
    return () => clearTimeout(timeout)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (gradeBarTimerRef.current) clearTimeout(gradeBarTimerRef.current)
    }
  }, [])

  const currentWord = words[currentIdx]

  const handleFlipped = useCallback(() => {
    gradeBarTimerRef.current = setTimeout(() => setShowGradeBar(true), 500)
  }, [])

  const handleGrade = async (result: GradeResult) => {
    if (saving || !currentWord) return
    setSaving(true)
    try {
      const response = await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ set_id, word_id: currentWord.word_id, result }),
      })
      if (!response.ok) {
        console.error('[CardStack] Failed to save grade:', response.status)
      }
    } catch (err) {
      console.error('[CardStack] Network error saving grade:', err)
    }
    setResults(prev => [...prev.filter(p => p.word_id !== currentWord.word_id), { word_id: currentWord.word_id, result }])
    setCurrentIdx(i => i + 1)
    setShowGradeBar(false)
    setSaving(false)
  }

  const handlePlayAgain = () => {
    setCurrentIdx(0)
    setResults([])
    setShowGradeBar(false)
  }

  if (preloading) return <GameLoadingScreen />

  if (currentIdx >= total) {
    return <ScoreScreen words={words} results={results} onPlayAgain={handlePlayAgain} />
  }

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

      <FlashCard
        key={currentWord.word_id}
        word={currentWord}
        onFlipped={handleFlipped}
        bgGradient={GRADIENTS[currentIdx % GRADIENTS.length]}
      />

      {showGradeBar && (
        <div className="w-full max-w-[420px] mt-0 animate-slideUp">
          <SelfGradeBar onGrade={handleGrade} disabled={saving} />
        </div>
      )}
    </div>
  )
}
