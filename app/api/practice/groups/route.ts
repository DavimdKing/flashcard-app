import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: appUser } = await supabase
    .from('users').select('is_approved').eq('id', user.id).single()
  if (!appUser?.is_approved) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const service = createServiceClient()

  const [groupsResult, bestScoresResult] = await Promise.all([
    service.from('practice_groups').select('id, name, icon').eq('is_active', true).order('created_at'),
    service.rpc('get_user_practice_best_scores', { p_user_id: user.id }),
  ])

  const groups = groupsResult.data ?? []
  const bestMap = new Map<string, number>(
    (bestScoresResult.data ?? []).map((r: { group_id: string; best_score: number }) => [r.group_id, r.best_score])
  )

  return NextResponse.json(
    groups.map(g => ({ ...g, best_score: bestMap.get(g.id) ?? null }))
  )
}
