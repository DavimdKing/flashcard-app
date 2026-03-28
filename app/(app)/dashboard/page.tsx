// app/(app)/dashboard/page.tsx
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import ScoreChart, { type ScoreEntry } from '@/components/dashboard/ScoreChart'
import StatCard from '@/components/dashboard/StatCard'
import MistakeWordsCard from '@/components/dashboard/MistakeWordsCard'
import PracticeBestScores from '@/components/dashboard/PracticeBestScores'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const displayName: string = user.user_metadata?.full_name ?? user.email ?? 'there'
  const firstName = displayName.split(' ')[0]

  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? 'Good morning' :
    hour < 18 ? 'Good afternoon' :
    'Good evening'

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  const service = createServiceClient()
  const { data: rawScores } = await service.rpc('get_user_recent_scores', {
    p_user_id: user.id,
    p_limit: 7,
  })

  const scores: ScoreEntry[] = (rawScores ?? []) as ScoreEntry[]

  const recentAvg = scores.length > 0
    ? Math.round(scores.reduce((sum, s) => sum + s.score_pct, 0) / scores.length)
    : null

  const bestScore = scores.length > 0
    ? Math.max(...scores.map(s => s.score_pct))
    : null

  return (
    <main className="p-4 md:p-8 max-w-2xl">
      {/* Greeting row */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{greeting}, {firstName} 👋</h1>
          <p className="text-sm text-gray-500 mt-0.5">{today}</p>
        </div>
        <Link
          href="/play"
          className="w-full md:w-auto bg-purple-600 hover:bg-purple-700 text-white font-semibold px-5 py-2.5 rounded-xl text-sm text-center transition"
        >
          ▶ Play Today&apos;s Set
        </Link>
      </div>

      {/* Score chart */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Last 7 Games</h2>
        <ScoreChart scores={scores} />
      </div>

      {/* Stat cards */}
      {scores.length > 0 && (
        <div className="flex gap-3">
          <StatCard
            label="Recent avg"
            value={`${recentAvg}%`}
            valueColor="text-purple-600"
          />
          <StatCard
            label="Best score"
            value={`${bestScore}%`}
            valueColor="text-green-600"
          />
          <MistakeWordsCard userId={user.id} />
        </div>
      )}
      <PracticeBestScores />
    </main>
  )
}
