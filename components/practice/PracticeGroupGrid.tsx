'use client'

import Link from 'next/link'
import type { PracticeGroupSummary } from '@/lib/types'

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
  groups: PracticeGroupSummary[]
  onToggle: () => void
  onPreview: (id: string) => void
}

export default function PracticeGroupGrid({ groups, onToggle, onPreview }: Props) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-800">Practice</h1>
        <button
          onClick={onToggle}
          className="flex items-center gap-1.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition"
        >
          ☰ List
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {groups.map((g, i) => (
          <div key={g.id} className="relative">
            <Link
              href={`/practice/${g.id}`}
              className={`bg-gradient-to-br ${GRADIENTS[i % GRADIENTS.length]} rounded-2xl p-5 flex flex-col items-center text-center shadow-sm hover:scale-[1.02] transition-transform block`}
            >
              <span className="text-4xl mb-2">{g.icon}</span>
              <span className="font-bold text-white text-sm drop-shadow">
                {g.name}
              </span>
              <span className="text-white/80 text-xs mt-1">20 words</span>
            </Link>

            {/* Preview button — overlays top-right of card */}
            <button
              onClick={() => onPreview(g.id)}
              className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full bg-white/30 hover:bg-white/60 text-white text-sm transition"
              title="Preview words"
              aria-label={`Preview words in ${g.name}`}
            >
              👁
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
