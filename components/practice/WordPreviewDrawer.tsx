'use client'

import { useEffect, useState } from 'react'

interface PreviewWord {
  id: string
  english_word: string
  part_of_speech: string | null
  thai_translation: string
  english_example: string | null
  thai_example: string | null
}

interface Props {
  groupId: string
  groupName: string
  groupIcon: string
  onClose: () => void
}

export default function WordPreviewDrawer({
  groupId,
  groupName,
  groupIcon,
  onClose,
}: Props) {
  const [words, setWords] = useState<PreviewWord[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)

  useEffect(() => {
    setLoading(true)
    setFetchError(false)
    setWords(null)

    fetch(`/api/practice/groups/${groupId}/words`)
      .then((r) => {
        if (!r.ok) throw new Error('failed')
        return r.json() as Promise<PreviewWord[]>
      })
      .then((data) => {
        setWords(data)
        setLoading(false)
      })
      .catch(() => {
        setFetchError(true)
        setLoading(false)
      })
  }, [groupId])

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[80vh] flex flex-col">
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 pt-2 pb-3 border-b border-gray-100">
          <span className="text-2xl">{groupIcon}</span>
          <div className="flex-1">
            <p className="font-bold text-gray-800">{groupName}</p>
            <p className="text-xs text-gray-400">Word preview · 20 words</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 text-sm transition"
            aria-label="Close preview"
          >
            ✕
          </button>
        </div>

        {/* Word list */}
        <div className="overflow-y-auto flex-1 px-4 py-2 pb-6">
          {loading && (
            <p className="text-center py-10 text-gray-400 text-sm">
              Loading words…
            </p>
          )}
          {fetchError && (
            <p className="text-center py-10 text-red-400 text-sm">
              Failed to load words. Please try again.
            </p>
          )}
          {words && (
            <div className="divide-y divide-gray-100">
              {words.map((w, i) => (
                <div key={w.id} className="py-3">
                  {/* Top row: number · english · POS · thai */}
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-gray-400 w-5 shrink-0 pt-0.5">
                      {i + 1}.
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center flex-wrap gap-1.5 mb-0.5">
                        <span className="font-semibold text-gray-800 text-sm">
                          {w.english_word}
                        </span>
                        {w.part_of_speech && (
                          <span className="text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full leading-none">
                            {w.part_of_speech}
                          </span>
                        )}
                        <span className="text-gray-500 text-sm ml-auto">
                          {w.thai_translation}
                        </span>
                      </div>

                      {/* Examples */}
                      {(w.english_example || w.thai_example) && (
                        <div className="text-xs text-gray-400 space-y-0.5 mt-1">
                          {w.english_example && (
                            <p className="italic">"{w.english_example}"</p>
                          )}
                          {w.thai_example && (
                            <p className="italic">"{w.thai_example}"</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
