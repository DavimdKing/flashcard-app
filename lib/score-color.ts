// lib/score-color.ts
export function scoreColor(pct: number): string {
  if (pct >= 90) return 'bg-green-600'
  if (pct >= 70) return 'bg-green-300'
  if (pct >= 40) return 'bg-amber-400'
  return 'bg-red-500'
}
