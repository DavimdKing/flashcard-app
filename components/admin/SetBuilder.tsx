'use client'

import { useState, useEffect } from 'react'
import { DndContext, closestCenter } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface WordItem {
  word_id: string
  english_word: string
  thai_translation: string
}

interface SetData {
  set_id: string | null
  published: boolean
  current_words: WordItem[]
  word_count: number
  can_random: boolean
  exclusion_days: number
}

export default function SetBuilder() {
  const [setData, setSetData] = useState<SetData | null>(null)
  const [selectedWords, setSelectedWords] = useState<WordItem[]>([])
  const [saving, setSaving] = useState(false)
  const [randomWarn, setRandomWarn] = useState(false)
  const [confirmOverwrite, setConfirmOverwrite] = useState(false)
  const [allWords, setAllWords] = useState<WordItem[]>([])
  const [search, setSearch] = useState('')
  const [showPreview, setShowPreview] = useState(false)

  useEffect(() => {
    fetch('/api/admin/daily-set').then(r => r.json()).then((data: SetData) => {
      setSetData(data)
      setSelectedWords(data.current_words ?? [])
    })
    fetch('/api/admin/words-list').then(r => r.json()).then((data: WordItem[]) => setAllWords(data))
  }, [])

  const handleRandom = async () => {
    const res = await fetch('/api/admin/daily-set', { method: 'PUT' })
    const json = await res.json()
    setSelectedWords(json.words.map((w: any) => ({ ...w, word_id: w.id })))
    setRandomWarn(json.warn)
  }

  const addWord = (word: WordItem) => {
    if (selectedWords.length >= 10) return
    if (selectedWords.find(w => w.word_id === word.word_id)) return
    setSelectedWords(prev => [...prev, word])
  }

  const removeWord = (wordId: string) => {
    setSelectedWords(prev => prev.filter(w => w.word_id !== wordId))
  }

  const handleDragEnd = ({ active, over }: any) => {
    if (!over || active.id === over.id) return
    setSelectedWords(prev => {
      const oldIdx = prev.findIndex(w => w.word_id === active.id)
      const newIdx = prev.findIndex(w => w.word_id === over.id)
      return arrayMove(prev, oldIdx, newIdx)
    })
  }

  const handleSave = async (publish: boolean) => {
    if (selectedWords.length !== 10) { alert('Select exactly 10 words'); return }
    if (setData?.published && publish && !confirmOverwrite) {
      setConfirmOverwrite(true)
      return
    }
    setSaving(true)
    const res = await fetch('/api/admin/daily-set', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        word_ids: selectedWords.map(w => w.word_id),
        publish,
        confirm_overwrite: confirmOverwrite,
      }),
    })
    setSaving(false)
    setConfirmOverwrite(false)
    if (res.ok) alert(publish ? 'Published!' : 'Saved as draft')
    else alert('Error saving')
  }

  const filteredWords = allWords.filter(w =>
    w.english_word.toLowerCase().includes(search.toLowerCase()) &&
    !selectedWords.find(s => s.word_id === w.word_id)
  )

  return (
    <div>
      {showPreview && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowPreview(false)}>
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-700 mb-4">Card Preview ({selectedWords.length} cards)</h3>
            <div className="grid grid-cols-2 gap-3">
              {selectedWords.map((w, i) => (
                <div key={w.word_id} className="bg-gradient-to-br from-pink-200 to-purple-200 rounded-2xl p-4 flex flex-col items-center gap-1">
                  <span className="text-xs text-white/70">#{i + 1}</span>
                  <span className="font-bold text-white text-lg">{w.english_word}</span>
                  <span className="text-sm text-white/80">{w.thai_translation}</span>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setShowPreview(false)} className="mt-4 text-sm text-gray-500">Close</button>
          </div>
        </div>
      )}
      <div className="flex gap-6">
        <div className="flex-1 bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-700">Word Pool ({setData?.word_count ?? 0} words)</h3>
            <button type="button" onClick={handleRandom} disabled={!setData?.can_random}
              className="text-sm bg-purple-100 text-purple-700 px-3 py-1 rounded-xl hover:bg-purple-200 disabled:opacity-40">
              🎲 Random
            </button>
          </div>
          {!setData?.can_random && (
            <p className="text-xs text-yellow-600 mb-2">Need at least 20 active words to use Random.</p>
          )}
          {randomWarn && (
            <p className="text-xs text-yellow-600 mb-2">⚠️ Some words were reused due to a small word pool.</p>
          )}
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search words…"
            className="w-full border rounded-xl px-3 py-1.5 text-sm mb-3 focus:outline-purple-400" />
          <div className="flex flex-col gap-1 max-h-96 overflow-y-auto">
            {filteredWords.map(w => (
              <button key={w.word_id} type="button" onClick={() => addWord(w)} disabled={selectedWords.length >= 10}
                className="text-left px-3 py-2 rounded-xl hover:bg-purple-50 text-sm text-gray-700 disabled:opacity-40">
                {w.english_word} <span className="text-gray-400">— {w.thai_translation}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="w-72 bg-white rounded-2xl p-4 shadow-sm flex flex-col">
          <h3 className="font-semibold text-gray-700 mb-3">Selected ({selectedWords.length}/10)</h3>
          {confirmOverwrite && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 mb-3">
              A set was already published today. This will also clear all user scores for today. Confirm?
              <div className="flex gap-2 mt-2">
                <button type="button" onClick={() => handleSave(true)} className="text-red-600 font-semibold">Yes, replace</button>
                <button type="button" onClick={() => setConfirmOverwrite(false)} className="text-gray-500">Cancel</button>
              </div>
            </div>
          )}
          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={selectedWords.map(w => w.word_id)} strategy={verticalListSortingStrategy}>
              {selectedWords.map((w, i) => (
                <SortableWordRow key={w.word_id} word={w} index={i} onRemove={() => removeWord(w.word_id)} />
              ))}
            </SortableContext>
          </DndContext>

          <div className="flex flex-col gap-2 mt-auto pt-4">
            <button type="button" onClick={() => setShowPreview(true)} disabled={selectedWords.length === 0}
              className="w-full border border-gray-200 text-gray-600 py-2 rounded-xl text-sm disabled:opacity-40">
              👁 Preview Cards
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={() => handleSave(false)} disabled={saving || selectedWords.length !== 10}
                className="flex-1 border border-purple-300 text-purple-600 py-2 rounded-xl text-sm font-medium disabled:opacity-40">
                Save Draft
              </button>
              <button type="button" onClick={() => handleSave(true)} disabled={saving || selectedWords.length !== 10}
                className="flex-1 bg-purple-500 text-white py-2 rounded-xl text-sm font-semibold disabled:opacity-40">
                {saving ? '…' : 'Publish'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SortableWordRow({ word, index, onRemove }: { word: WordItem; index: number; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: word.word_id })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
      className="flex items-center gap-2 px-3 py-2 bg-purple-50 rounded-xl mb-1 cursor-grab">
      <span {...attributes} {...listeners} className="text-gray-400 text-xs">⠿</span>
      <span className="text-xs text-gray-400 w-4">{index + 1}</span>
      <span className="text-sm text-gray-700 flex-1">{word.english_word}</span>
      <button type="button" onClick={onRemove} className="text-red-400 text-xs">✕</button>
    </div>
  )
}
