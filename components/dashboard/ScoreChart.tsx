// components/dashboard/ScoreChart.tsx
import { scoreColor } from '@/lib/score-color'

export interface ScoreEntry {
  set_date: string   // ISO date string, e.g. "2026-03-25"
  score_pct: number  // 0–100
}

const MAX_BAR_HEIGHT = 120 // px

function dayLabel(dateStr: string, short: boolean): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: short ? 'narrow' : 'short' })
}

interface Props {
  scores: ScoreEntry[]
}

export default function ScoreChart({ scores }: Props) {
  if (scores.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-400 text-sm text-center px-4">
        Play your first set to see your scores here.
      </div>
    )
  }

  // Scores arrive newest-first from DB; reverse to show oldest on left
  const ordered = [...scores].reverse()

  return (
    <div className="flex gap-2 items-end justify-around" style={{ height: `${MAX_BAR_HEIGHT + 40}px` }}>
      {ordered.map((entry) => {
        const barHeight = Math.max(4, Math.round(entry.score_pct / 100 * MAX_BAR_HEIGHT))
        const color = scoreColor(entry.score_pct)
        return (
          <div key={entry.set_date} className="flex flex-col items-center gap-1 flex-1">
            {/* Score label */}
            <span className="text-xs font-semibold text-gray-700">{entry.score_pct}%</span>
            {/* Bar */}
            <div
              className={`w-full rounded-t-md ${color}`}
              style={{ height: `${barHeight}px` }}
            />
            {/* Day label — short on mobile, long on desktop */}
            <span className="text-[10px] text-gray-400 md:hidden">{dayLabel(entry.set_date, true)}</span>
            <span className="text-xs text-gray-400 hidden md:block">{dayLabel(entry.set_date, false)}</span>
          </div>
        )
      })}
    </div>
  )
}
