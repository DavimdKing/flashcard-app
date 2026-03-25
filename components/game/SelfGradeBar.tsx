'use client'

import type { GradeResult } from '@/lib/types'

interface Props {
  onGrade: (result: GradeResult) => void
  disabled: boolean
}

export default function SelfGradeBar({ onGrade, disabled }: Props) {
  return (
    <div className="flex gap-3 w-full mt-4">
      <button
        type="button"
        onClick={() => !disabled && onGrade('nope')}
        disabled={disabled}
        className="flex-1 py-4 rounded-2xl bg-red-100 text-red-600 font-bold text-lg hover:bg-red-200 disabled:opacity-40 transition"
      >
        😢 Nope
      </button>
      <button
        type="button"
        onClick={() => !disabled && onGrade('got_it')}
        disabled={disabled}
        className="flex-1 py-4 rounded-2xl bg-green-100 text-green-700 font-bold text-lg hover:bg-green-200 disabled:opacity-40 transition"
      >
        ✅ Got it!
      </button>
    </div>
  )
}
