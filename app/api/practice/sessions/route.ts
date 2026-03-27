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

  // Insert session
  const { data: session, error } = await service
    .from('practice_sessions')
    .insert({ user_id: user.id, group_id, score_pct })
    .select('id, score_pct')
    .single()
  if (error) return NextResponse.json({ error: 'Failed to save' }, { status: 500 })

  // Compute new best (after insert, so count >= 1)
  const { data: bestRow } = await service
    .from('practice_sessions')
    .select('score_pct')
    .eq('user_id', user.id)
    .eq('group_id', group_id)
    .order('score_pct', { ascending: false })
    .limit(1)
    .single()

  const best_score = bestRow?.score_pct ?? score_pct

  // Count total sessions for this user+group to detect first play
  const { count } = await service
    .from('practice_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('group_id', group_id)

  const is_new_best = (count ?? 1) <= 1 || score_pct >= best_score

  return NextResponse.json({ id: session.id, score_pct, best_score, is_new_best })
}
