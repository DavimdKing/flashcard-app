'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import WordPicker from '@/components/admin/WordPicker'

interface WordResult { id: string; english_word: string; thai_translation: string }

export default function NewPracticeGroupPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('')
  const [isActive, setIsActive] = useState(false)
  const [words, setWords] = useState<WordResult[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const canActivate = words.length === 20

  const handleSave = async () => {
    setError('')
    setSaving(true)
    try {
      const res = await fetch('/api/admin/practice-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, icon, is_active: isActive, word_ids: words.map(w => w.id) }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to save')
        return
      }
      router.push('/admin/practice-groups')
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-xl">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">New Practice Group</h2>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Group Name</label>
          <input value={name} onChange={e => setName(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
            placeholder="e.g. Food & Drinks" />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Icon (emoji)</label>
          <input value={icon} onChange={e => setIcon(e.target.value)} maxLength={2}
            className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-xl text-center focus:outline-none focus:ring-2 focus:ring-purple-400"
            placeholder="🍎" />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Status</label>
          <div className="flex gap-2">
            {(['Draft', 'Active'] as const).map(status => {
              const active = status === 'Active'
              const selected = isActive === active
              const disabled = active && !canActivate
              return (
                <button key={status} type="button"
                  onClick={() => !disabled && setIsActive(active)}
                  disabled={disabled}
                  title={disabled ? 'Add 20 words first' : undefined}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${selected ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'} ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:opacity-80'}`}>
                  {status}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Words</label>
          <WordPicker selected={words} onChange={setWords} />
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button onClick={handleSave} disabled={saving || !name || !icon}
            className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold py-2 rounded-xl text-sm transition">
            {saving ? 'Saving…' : 'Save Group'}
          </button>
          <button onClick={() => router.back()} type="button"
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
