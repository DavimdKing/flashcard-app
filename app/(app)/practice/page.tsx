import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import type { PracticeGroupSummary } from '@/lib/types'
import PracticeHubClient from './PracticeHubClient'

export const dynamic = 'force-dynamic'

export default async function PracticePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: appUser } = await supabase
    .from('users').select('is_approved').eq('id', user.id).single()
  if (!appUser?.is_approved) redirect('/access-denied')

  const service = createServiceClient()
  const [groupsResult, bestScoresResult] = await Promise.all([
    service.from('practice_groups').select('id, name, icon').eq('is_active', true).order('created_at'),
    service.rpc('get_user_practice_best_scores', { p_user_id: user.id }),
  ])

  const bestMap = new Map<string, number>(
    ((bestScoresResult.data ?? []) as { group_id: string; best_score: number }[])
      .map(r => [r.group_id, r.best_score])
  )

  const groups: PracticeGroupSummary[] = (groupsResult.data ?? []).map(g => ({
    id: g.id,
    name: g.name,
    icon: g.icon,
    word_count: 20,
    best_score: bestMap.get(g.id) ?? null,
  }))

  return (
    <main className="p-4 md:p-8 max-w-2xl">
      <PracticeHubClient groups={groups} />
    </main>
  )
}
