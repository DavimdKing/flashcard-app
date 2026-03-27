'use client'

import Link from 'next/link'
import { scoreColor } from '@/lib/score-color'
import type { PracticeGroupSummary } from '@/lib/types'

interface Props {
  groups: PracticeGroupSummary[]
  onToggle: () => void
}

export default function PracticeGroupList({ groups, onToggle }: Props) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-800">Practice</h1>
        <button onClick={onToggle}
          className="flex items-center gap-1.5 text-sm font-medium text-white bg-purple-600 rounded-lg px-3 py-1.5 hover:bg-purple-700 transition">
          ⊞ Grid
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {groups.map(g => (
          <Link key={g.id} href={`/practice/${g.id}`}
            className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm hover:bg-gray-50 transition">
            <div className="bg-purple-100 rounded-xl p-2 text-xl">{g.icon}</div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-800 text-sm truncate">{g.name}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                  {g.best_score !== null && (
                    <div
                      className={`h-1.5 rounded-full ${scoreColor(g.best_score)}`}
                      style={{ width: `${g.best_score}%` }}
                    />
                  )}
                </div>
                <span className={`text-xs font-bold ${g.best_score !== null ? 'text-gray-700' : 'text-gray-400'}`}>
                  {g.best_score !== null ? `${g.best_score}%` : '—'}
                </span>
              </div>
            </div>
            <span className="text-gray-300 text-lg">›</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
