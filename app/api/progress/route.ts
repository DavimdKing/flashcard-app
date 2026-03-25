import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import type { ProgressResponse, ProgressResult, GradeResult } from '@/lib/types'

export function buildProgressResponse(
  setId: string,
  results: ProgressResult[],
  total: number
): ProgressResponse {
  return { set_id: setId, results, total, graded: results.length }
}

export function validateProgressBody(body: unknown): boolean {
  if (typeof body !== 'object' || body === null) return false
  const b = body as Record<string, unknown>
  return (
    typeof b.set_id === 'string' &&
    typeof b.word_id === 'string' &&
    (b.result === 'got_it' || b.result === 'nope')
  )
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const setId = searchParams.get('set_id')
  if (!setId) return NextResponse.json({ error: 'Missing set_id' }, { status: 400 })

  const service = createServiceClient()

  const { data: setWords } = await service
    .from('daily_set_words')
    .select('word_id')
    .eq('set_id', setId)

  const total = setWords?.length ?? 0

  const { data: progress } = await service
    .from('user_progress')
    .select('word_id, result')
    .eq('user_id', user.id)
    .eq('set_id', setId)

  const results: ProgressResult[] = (progress ?? []).map(p => ({
    word_id: p.word_id,
    result: p.result as GradeResult,
  }))

  return NextResponse.json(buildProgressResponse(setId, results, total))
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!validateProgressBody(body)) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { set_id, word_id, result } = body as { set_id: string; word_id: string; result: GradeResult }

  const service = createServiceClient()
  const { data: setWord } = await service
    .from('daily_set_words')
    .select('word_id')
    .eq('set_id', set_id)
    .eq('word_id', word_id)
    .single()

  if (!setWord) {
    return NextResponse.json({ error: 'Word not in set' }, { status: 409 })
  }

  const { error } = await service
    .from('user_progress')
    .upsert(
      { user_id: user.id, set_id, word_id, result, played_at: new Date().toISOString() },
      { onConflict: 'user_id,set_id,word_id' }
    )

  if (error) return NextResponse.json({ error: 'Failed to save' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
