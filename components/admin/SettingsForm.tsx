'use client'

import { useState } from 'react'

interface Props {
  initialDays: number
}

export default function SettingsForm({ initialDays }: Props) {
  const [days, setDays] = useState(initialDays)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ random_exclusion_days: days }),
    })
    setSaving(false)
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2000) }
    else alert('Save failed')
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-sm max-w-sm mt-6">
      <h3 className="font-semibold text-gray-700 mb-3">Settings</h3>
      <label className="flex flex-col gap-1">
        <span className="text-sm text-gray-500">Random exclusion window (days)</span>
        <input type="number" value={days} onChange={e => setDays(Number(e.target.value))}
          min={1} max={60} className="border rounded-xl px-3 py-2 w-24 focus:outline-purple-400" />
        <span className="text-xs text-gray-400">Words used in the last N days won't appear in random picks (max 60)</span>
      </label>
      <button type="submit" disabled={saving}
        className="mt-3 text-sm bg-purple-100 text-purple-700 px-4 py-2 rounded-xl disabled:opacity-50">
        {saved ? 'Saved ✓' : saving ? 'Saving…' : 'Save'}
      </button>
    </form>
  )
}
