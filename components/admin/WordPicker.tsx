'use client'

import { useState, useRef, useEffect } from 'react'

interface WordResult {
  id: string
  english_word: string
  thai_translation: string
}

interface Props {
  selected: WordResult[]
  onChange: (words: WordResult[]) => void
  maxWords?: number
}

export default function WordPicker({ selected, onChange, maxWords = 20 }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<WordResult[]>([])
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) { setResults([]); return }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/admin/practice-groups/words?q=${encodeURIComponent(query)}`)
        const data = await res.json()
        setResults(data)
      } finally {
        setLoading(false)
      }
    }, 300)
  }, [query])

  const selectedIds = new Set(selected.map(w => w.id))

  const addWord = (word: WordResult) => {
    if (selectedIds.has(word.id) || selected.length >= maxWords) return
    onChange([...selected, word])
    setQuery('')
    setResults([])
  }

  const removeWord = (id: string) => {
    onChange(selected.filter(w => w.id !== id))
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={selected.length >= maxWords ? 'Maximum 20 words reached' : 'Search words…'}
          disabled={selected.length >= maxWords}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 disabled:bg-gray-100"
        />
        {results.length > 0 && (
          <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {results.map(w => (
              <li key={w.id}>
                <button
                  type="button"
                  onClick={() => addWord(w)}
                  disabled={selectedIds.has(w.id)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-purple-50 disabled:text-gray-400 disabled:cursor-default"
                >
                  <span className="font-medium">{w.english_word}</span>
                  <span className="text-gray-400 ml-2">{w.thai_translation}</span>
                  {selectedIds.has(w.id) && <span className="ml-2 text-xs text-green-600">✓ added</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
        {loading && <p className="absolute right-3 top-2 text-xs text-gray-400">Searching…</p>}
      </div>

      <div className="flex flex-wrap gap-2">
        {selected.map(w => (
          <span key={w.id} className="inline-flex items-center gap-1 bg-purple-100 text-purple-800 text-xs font-medium px-2 py-1 rounded-full">
            {w.english_word}
            <button type="button" onClick={() => removeWord(w.id)} className="text-purple-500 hover:text-purple-700">×</button>
          </span>
        ))}
      </div>

      <p className="text-xs text-gray-500">{selected.length} / {maxWords} words selected</p>
    </div>
  )
}
