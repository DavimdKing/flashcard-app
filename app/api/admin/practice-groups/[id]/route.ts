import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: appUser } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
  return appUser?.is_admin ? user : null
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  const body = await request.json().catch(() => null)
  const { name, icon, is_active, word_ids } = (body ?? {}) as Record<string, unknown>

  if (!name || !icon || !Array.isArray(word_ids)) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }
  if (is_active && word_ids.length !== 20) {
    return NextResponse.json({ error: 'Active groups require exactly 20 words' }, { status: 422 })
  }

  const service = createServiceClient()
  const { error } = await service.rpc('replace_practice_group_words', {
    p_group_id: id,
    p_name: name,
    p_icon: icon,
    p_is_active: !!is_active,
    p_word_ids: word_ids,
  })
  if (error) return NextResponse.json({ error: 'Failed to update' }, { status: 500 })

  return NextResponse.json({ ok: true })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  const service = createServiceClient()
  const { error } = await service.from('practice_groups').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
