import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: appUser } = await supabase
    .from('users').select('is_approved').eq('id', user.id).single()
  if (!appUser?.is_approved) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const { group_id, score_pct } = (body ?? {}) as Record<string, unknown>

  if (
    typeof group_id !== 'string' || !UUID_RE.test(group_id) ||
    typeof score_pct !== 'number' || !Number.isInteger(score_pct) ||
    score_pct < 0 || score_pct > 100
  ) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const service = createServiceClient()

  // Verify group exists and is active
  const { data: group } = await service
    .from('practice_groups').select('id').eq('id', group_id).eq('is_active', true).single()
  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 })

  // Query previous best BEFORE insert to detect first play and compare correctly
  const { data: prevBestRow } = await service
    .from('practice_sessions')
    .select('score_pct')
    .eq('user_id', user.id)
    .eq('group_id', group_id)
    .order('score_pct', { ascending: false })
    .limit(1)
    .maybeSingle()

  const isFirstPlay = prevBestRow === null
  const previousBest: number | null = prevBestRow?.score_pct ?? null

  // Insert session
  const { data: session, error } = await service
    .from('practice_sessions')
    .insert({ user_id: user.id, group_id, score_pct })
    .select('id, score_pct')
    .single()
  if (error) return NextResponse.json({ error: 'Failed to save' }, { status: 500 })

  const best_score = previousBest === null ? score_pct : Math.max(score_pct, previousBest)
  const is_new_best = isFirstPlay || score_pct > (previousBest ?? -1)

  return NextResponse.json({ id: session.id, score_pct, best_score, is_new_best })
}
