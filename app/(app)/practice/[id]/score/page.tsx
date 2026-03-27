import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { scoreColor } from '@/lib/score-color'

export default async function PracticeScorePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ pct?: string; best?: string; new?: string }>
}) {
  const { id } = await params
  const sp = await searchParams

  const pct  = Math.min(100, Math.max(0, parseInt(sp.pct  ?? '0', 10) || 0))
  const best = Math.min(100, Math.max(0, parseInt(sp.best ?? '0', 10) || 0))
  const isNewBest = sp.new === '1'

  const service = createServiceClient()
  const { data: group } = await service
    .from('practice_groups').select('name, icon').eq('id', id).single()

  if (!group) redirect('/practice')

  // Map bg- classes to text- equivalents (explicit so Tailwind JIT includes them)
  const bgToText: Record<string, string> = {
    'bg-green-600': 'text-green-600',
    'bg-green-300': 'text-green-500',
    'bg-amber-400': 'text-amber-500',
    'bg-red-500':   'text-red-500',
  }
  const pctColor  = bgToText[scoreColor(pct)]  ?? 'text-gray-700'
  const bestColor = bgToText[scoreColor(best)] ?? 'text-gray-700'

  return (
    <main className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="bg-white rounded-3xl shadow-lg p-8 w-full max-w-sm flex flex-col items-center gap-4 text-center">
        <span className="text-5xl">{group.icon}</span>
        <h2 className="text-lg font-bold text-gray-800">{group.name}</h2>

        {isNewBest && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-2 text-yellow-700 text-sm font-semibold">
            New best score! 🎉
          </div>
        )}

        <div className="w-full">
          <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Your Score</p>
          <p className={`text-5xl font-bold ${pctColor}`}>{pct}%</p>
        </div>

        <div className="w-full border-t pt-3">
          <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Your Best</p>
          <p className={`text-2xl font-bold ${bestColor}`}>{best}%</p>
        </div>

        <div className="flex flex-col gap-2 w-full mt-2">
          <Link href={`/practice/${id}`}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-2xl text-sm transition text-center">
            🔄 Play Again
          </Link>
          <Link href="/practice"
            className="w-full text-gray-500 hover:text-gray-700 font-medium py-2 text-sm text-center">
            ← Back to Practice
          </Link>
        </div>
      </div>
    </main>
  )
}
