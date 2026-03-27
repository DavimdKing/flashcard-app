'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { scoreColor } from '@/lib/score-color'

interface GroupScore {
  id: string
  name: string
  icon: string
  best_score: number | null
}

export default function PracticeBestScores() {
  const [groups, setGroups] = useState<GroupScore[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/practice/groups')
      .then(r => r.ok ? r.json() : [])
      .then(setGroups)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return null

  if (groups.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mt-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Practice</h2>
        <p className="text-sm text-gray-400">No practice scores yet — try a group!</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mt-4">
      <h2 className="text-sm font-semibold text-gray-700 mb-4">Practice — Best Scores</h2>
      <div className="flex gap-4 overflow-x-auto pb-1">
        {groups.map(g => (
          <Link key={g.id} href={`/practice/${g.id}`}
            className="flex flex-col items-center gap-1.5 flex-shrink-0 w-16 hover:opacity-80 transition">
            <span className="text-2xl">{g.icon}</span>
            <span className="text-xs text-gray-600 font-medium text-center w-full overflow-hidden text-ellipsis whitespace-nowrap">
              {g.name}
            </span>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
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
          </Link>
        ))}
      </div>
    </div>
  )
}
