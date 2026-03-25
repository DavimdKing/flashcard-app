'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Word } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { PARTS_OF_SPEECH } from '@/lib/constants'

interface Props {
  word?: Word
}

export default function WordForm({ word }: Props) {
  const router = useRouter()
  const isEdit = !!word
  const [englishWord, setEnglishWord] = useState(word?.english_word ?? '')
  const [thaiTranslation, setThaiTranslation] = useState(word?.thai_translation ?? '')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState(word?.image_url ?? '')
  const [saving, setSaving] = useState(false)
  const [audioStatus, setAudioStatus] = useState<'idle' | 'generating' | 'done' | 'error'>('idle')
  const [audioWarning, setAudioWarning] = useState(false)
  const [partOfSpeech, setPartOfSpeech] = useState<string>(word?.part_of_speech ?? '')
  const [englishExample, setEnglishExample] = useState(word?.english_example ?? '')
  const [thaiExample, setThaiExample] = useState(word?.thai_example ?? '')

  const supabase = createClient()

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!englishWord || !thaiTranslation) return
    if (!isEdit && !imageFile) return

    setSaving(true)
    const wordId = word?.id ?? crypto.randomUUID()
    let imageUrl = word?.image_url ?? ''

    if (imageFile) {
      const { data: { session } } = await supabase.auth.getSession()
      const formData = new FormData()
      formData.append('file', imageFile)
      formData.append('word_id', wordId)
      const res = await fetch('/api/admin/words/upload-image', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: formData,
      })
      const json = await res.json()
      if (!res.ok) { setSaving(false); alert('Image upload failed'); return }
      imageUrl = json.image_url
    }

    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(isEdit ? `/api/admin/words/${wordId}` : '/api/admin/words', {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ id: wordId, english_word: englishWord, thai_translation: thaiTranslation, image_url: imageUrl, part_of_speech: partOfSpeech || null, english_example: englishExample || null, thai_example: thaiExample || null }),
    })
    const json = await res.json()
    if (!res.ok) { setSaving(false); alert('Save failed'); return }

    if (json.audio_warning) setAudioWarning(true)
    setSaving(false)
    if (!json.audio_warning) router.push('/admin/words')
  }

  const retryAudio = async () => {
    if (!word) return
    setAudioStatus('generating')
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ word_id: word.id, english_word: englishWord }),
    })
    setAudioStatus(res.ok ? 'done' : 'error')
    if (res.ok) setAudioWarning(false)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 max-w-lg">
      {audioWarning && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 flex items-center justify-between">
          <p className="text-yellow-700 text-sm">Word saved, but audio generation failed.</p>
          <button type="button" onClick={retryAudio} className="text-sm text-yellow-700 font-semibold underline">
            {audioStatus === 'generating' ? 'Retrying…' : audioStatus === 'done' ? 'Done ✓' : 'Click to retry'}
          </button>
        </div>
      )}

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-gray-600">English Word *</span>
        <input value={englishWord} onChange={e => setEnglishWord(e.target.value)} required
          className="border rounded-xl px-3 py-2 text-gray-800 focus:outline-purple-400" />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-gray-600">Thai Translation *</span>
        <input value={thaiTranslation} onChange={e => setThaiTranslation(e.target.value)} required
          className="border rounded-xl px-3 py-2 text-gray-800 focus:outline-purple-400" />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-gray-600">Part of Speech</span>
        <select
          value={partOfSpeech}
          onChange={e => setPartOfSpeech(e.target.value)}
          className="border rounded-xl px-3 py-2 text-gray-800 focus:outline-purple-400"
        >
          <option value="">— optional —</option>
          {PARTS_OF_SPEECH.map(pos => (
            <option key={pos} value={pos}>{pos}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-gray-600">English Example</span>
        <textarea
          value={englishExample}
          onChange={e => setEnglishExample(e.target.value)}
          rows={2}
          placeholder="e.g. The cat sat on the mat."
          className="border rounded-xl px-3 py-2 text-gray-800 focus:outline-purple-400 resize-none"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-gray-600">Thai Example</span>
        <textarea
          value={thaiExample}
          onChange={e => setThaiExample(e.target.value)}
          rows={2}
          placeholder="e.g. แมวนั่งอยู่บนพรม"
          className="border rounded-xl px-3 py-2 text-gray-800 focus:outline-purple-400 resize-none"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-gray-600">Image {!isEdit && '*'}</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageChange} required={!isEdit} />
        {imagePreview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imagePreview} alt="preview" className="w-32 h-32 object-cover rounded-xl mt-1" />
        )}
        <span className="text-xs text-gray-400">JPG / PNG / WebP, max 5 MB</span>
      </label>

      <button type="submit" disabled={saving || (!isEdit && !imageFile)}
        className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 rounded-2xl disabled:opacity-50 transition">
        {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Word'}
      </button>
    </form>
  )
}
