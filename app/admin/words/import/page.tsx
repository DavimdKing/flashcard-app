'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { PARTS_OF_SPEECH } from '@/lib/constants'
import { createClient } from '@/lib/supabase/client'

const REQUIRED_HEADERS = ['vocabulary', 'part of speech', 'thai meaning', 'thai example', 'english example']
const MAX_ROWS = 200

interface ParsedRow {
  rowNum: number
  english_word: string
  part_of_speech: string | null
  thai_translation: string
  thai_example: string | null
  english_example: string | null
  errors: string[]
}

type SaveResult = {
  saved: number
  audio_failures: string[]
  errors: Array<{ english_word: string; reason: string }>
} | null

export default function ImportPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [saving, setSaving] = useState(false)
  const [saveResult, setSaveResult] = useState<SaveResult>(null)
  const [parseError, setParseError] = useState('')

  const supabase = createClient()

  const validRows = rows.filter(r => r.errors.length === 0)
  const errorRows = rows.filter(r => r.errors.length > 0)

  const handleFile = async (file: File) => {
    setParseError('')
    setSaveResult(null)
    setRows([])
    setFileName(file.name)

    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const raw: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

    if (raw.length < 2) {
      setParseError('File appears to be empty or has no data rows.')
      return
    }

    const headers = (raw[0] as string[]).map(h => String(h).toLowerCase().trim())
    const missingHeaders = REQUIRED_HEADERS.filter(h => !headers.includes(h))
    if (missingHeaders.length > 0) {
      setParseError(`File format does not match the expected template. Missing headers: ${missingHeaders.join(', ')}. Please check column headers.`)
      return
    }

    const dataRows = raw.slice(1).filter(r => r.some(cell => String(cell).trim() !== ''))

    if (dataRows.length > MAX_ROWS) {
      setParseError(`This file has more than ${MAX_ROWS} rows. Please split it into smaller batches.`)
      return
    }

    const colIdx = {
      vocabulary: headers.indexOf('vocabulary'),
      pos: headers.indexOf('part of speech'),
      thai: headers.indexOf('thai meaning'),
      thaiEx: headers.indexOf('thai example'),
      engEx: headers.indexOf('english example'),
    }

    const parsed: ParsedRow[] = dataRows.map((row, i) => {
      const get = (idx: number) => String((row as string[])[idx] ?? '').trim() || null
      const english_word = get(colIdx.vocabulary) ?? ''
      const thai_translation = get(colIdx.thai) ?? ''
      const posRaw = get(colIdx.pos)
      const part_of_speech = posRaw ? posRaw.toLowerCase() : null
      const thai_example = get(colIdx.thaiEx)
      const english_example = get(colIdx.engEx)

      const errors: string[] = []
      if (!english_word) errors.push('Missing Vocabulary')
      if (!thai_translation) errors.push('Missing Thai')
      if (part_of_speech && !(PARTS_OF_SPEECH as readonly string[]).includes(part_of_speech)) {
        errors.push('Invalid POS')
      }

      return { rowNum: i + 2, english_word, part_of_speech, thai_translation, thai_example, english_example, errors }
    })

    // Detect intra-file duplicates (first wins)
    const seen = new Set<string>()
    for (const row of parsed) {
      if (!row.english_word) continue
      const key = row.english_word.toLowerCase()
      if (seen.has(key)) {
        row.errors.push('Duplicate in file')
      } else {
        seen.add(key)
      }
    }

    // Check DB duplicates
    const { data: { session } } = await supabase.auth.getSession()
    const allWords = parsed.map(r => r.english_word).filter(Boolean)
    if (allWords.length > 0) {
      const res = await fetch('/api/admin/words/check-duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ words: allWords }),
      })
      if (res.ok) {
        const { duplicates }: { duplicates: string[] } = await res.json()
        const dupSet = new Set(duplicates.map(d => d.toLowerCase()))
        for (const row of parsed) {
          if (dupSet.has(row.english_word.toLowerCase()) && !row.errors.includes('Duplicate in file')) {
            row.errors.push('Duplicate in DB')
          }
        }
      }
    }

    setRows(parsed)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const handleSave = async () => {
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/admin/words/bulk-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({
        words: validRows.map(r => ({
          english_word: r.english_word,
          thai_translation: r.thai_translation,
          part_of_speech: r.part_of_speech,
          english_example: r.english_example,
          thai_example: r.thai_example,
        })),
      }),
    })
    const result = await res.json()
    setSaveResult(result)
    setSaving(false)
  }

  const STATUS_BADGE: Record<string, string> = {
    'Missing Vocabulary': 'bg-red-100 text-red-700',
    'Missing Thai': 'bg-red-100 text-red-700',
    'Duplicate in DB': 'bg-red-100 text-red-700',
    'Duplicate in file': 'bg-red-100 text-red-700',
    'Invalid POS': 'bg-red-100 text-red-700',
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Import Words from Excel</h2>

      {saveResult && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-2xl">
          <p className="font-semibold text-green-800">{saveResult.saved} words saved successfully.</p>
          {saveResult.audio_failures.length > 0 && (
            <p className="text-sm text-yellow-700 mt-1">
              Audio generation failed for: {saveResult.audio_failures.join(', ')}. You can retry from each word&apos;s edit page.
            </p>
          )}
          {saveResult.errors.length > 0 && (
            <p className="text-sm text-red-700 mt-1">
              Failed to save: {saveResult.errors.map(e => e.english_word).join(', ')}.
            </p>
          )}
          <button
            onClick={() => router.push('/admin/words')}
            className="mt-3 text-sm text-green-700 underline"
          >
            Back to word list
          </button>
        </div>
      )}

      {!fileName ? (
        <div
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          className="border-2 border-dashed border-gray-300 rounded-2xl p-10 text-center cursor-pointer hover:border-purple-400 transition"
          onClick={() => fileInputRef.current?.click()}
        >
          <p className="text-gray-500">Drag & drop an Excel file here, or click to browse</p>
          <p className="text-xs text-gray-400 mt-1">.xlsx files only · max {MAX_ROWS} rows</p>
          <input ref={fileInputRef} type="file" accept=".xlsx" className="hidden" onChange={handleInputChange} />
        </div>
      ) : (
        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl mb-4">
          <span className="text-gray-700 font-medium text-sm">{fileName}</span>
          <button
            onClick={() => { setFileName(''); setRows([]); setSaveResult(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
            className="text-sm text-purple-600 underline"
          >
            Change file
          </button>
          <input ref={fileInputRef} type="file" accept=".xlsx" className="hidden" onChange={handleInputChange} />
        </div>
      )}

      {parseError && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {parseError}
        </div>
      )}

      {rows.length > 0 && !saveResult && (
        <>
          <div className="flex gap-3 mt-5 mb-3">
            <span className="px-3 py-1 rounded-lg bg-green-100 text-green-700 text-sm font-medium">
              ✓ {validRows.length} ready to import
            </span>
            {errorRows.length > 0 && (
              <span className="px-3 py-1 rounded-lg bg-red-100 text-red-700 text-sm font-medium">
                ✗ {errorRows.length} have errors
              </span>
            )}
          </div>

          <div className="overflow-x-auto rounded-2xl shadow-sm border border-gray-100">
            <table className="w-full text-sm bg-white">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="text-left px-3 py-2">#</th>
                  <th className="text-left px-3 py-2">Vocabulary</th>
                  <th className="text-left px-3 py-2">POS</th>
                  <th className="text-left px-3 py-2">Thai Meaning</th>
                  <th className="text-left px-3 py-2">English Example</th>
                  <th className="text-left px-3 py-2">Thai Example</th>
                  <th className="text-left px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.rowNum} className={`border-t ${row.errors.length > 0 ? 'bg-red-50' : ''}`}>
                    <td className="px-3 py-2 text-gray-400">{row.rowNum}</td>
                    <td className="px-3 py-2 font-medium">{row.english_word}</td>
                    <td className="px-3 py-2 text-gray-500">{row.part_of_speech ?? '—'}</td>
                    <td className="px-3 py-2 text-gray-500">{row.thai_translation}</td>
                    <td className="px-3 py-2 text-gray-400 italic">{row.english_example ?? '—'}</td>
                    <td className="px-3 py-2 text-gray-400 italic">{row.thai_example ?? '—'}</td>
                    <td className="px-3 py-2">
                      {row.errors.length === 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs">✓ Ready</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {row.errors.map(err => (
                            <span key={err} className={`px-2 py-0.5 rounded-full text-xs ${STATUS_BADGE[err] ?? 'bg-red-100 text-red-700'}`}>
                              ✗ {err}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center mt-4">
            <p className="text-xs text-gray-400">Rows with errors are skipped. Fix them in Excel and re-upload.</p>
            <div className="flex gap-3">
              <button
                onClick={() => router.push('/admin/words')}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || validRows.length === 0}
                className="px-5 py-2 text-sm font-semibold bg-purple-500 hover:bg-purple-600 text-white rounded-xl disabled:opacity-50 transition"
              >
                {saving ? 'Saving…' : `Save ${validRows.length} valid word${validRows.length !== 1 ? 's' : ''} →`}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
