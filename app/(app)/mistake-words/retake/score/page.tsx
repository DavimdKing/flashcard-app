'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import MistakeRetakeScore from '@/components/mistake-words/MistakeRetakeScore'

interface RetakeWord {
  word_id: string
  english_word: string
}

interface RetakeResults {
  gotItWords: RetakeWord[]
  nopeWords: RetakeWord[]
}

export default function MistakeRetakeScorePage() {
  const router = useRouter()
  const [results, setResults] = useState<RetakeResults | null>(null)

  useEffect(() => {
    // sessionStorage is only available in the browser — must be inside useEffect
    const raw = sessionStorage.getItem('retake_results')
    if (!raw) {
      router.replace('/mistake-words')
      return
    }
    sessionStorage.removeItem('retake_results')
    try {
      setResults(JSON.parse(raw))
    } catch {
      router.replace('/mistake-words')
    }
  }, [router])

  // Render nothing during SSR or while reading sessionStorage
  if (!results) return null

  return <MistakeRetakeScore gotItWords={results.gotItWords} nopeWords={results.nopeWords} />
}
