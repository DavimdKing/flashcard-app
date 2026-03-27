import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: appUser } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
  return appUser?.is_admin ? user : null
}

export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const { name, icon, is_active, word_ids } = (body ?? {}) as Record<string, unknown>

  if (!name || !icon || !Array.isArray(word_ids)) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }
  if (is_active && word_ids.length !== 20) {
    return NextResponse.json({ error: 'Active groups require exactly 20 words' }, { status: 422 })
  }

  const service = createServiceClient()
  const { data: group, error } = await service
    .from('practice_groups')
    .insert({ name, icon, is_active: !!is_active })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: 'Failed to create' }, { status: 500 })

  if (word_ids.length > 0) {
    const { error: rpcError } = await service.rpc('replace_practice_group_words', {
      p_group_id: group.id,
      p_name: name,
      p_icon: icon,
      p_is_active: !!is_active,
      p_word_ids: word_ids,
    })
    if (rpcError) return NextResponse.json({ error: 'Failed to save words' }, { status: 500 })
  }

  return NextResponse.json({ id: group.id }, { status: 201 })
}
