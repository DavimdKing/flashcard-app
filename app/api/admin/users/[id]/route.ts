import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, admin: null }
  const { data: a } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
  return { user, admin: a?.is_admin ? user : null }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, admin } = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const updates: Record<string, boolean> = {}
  if (typeof body.is_approved === 'boolean') updates.is_approved = body.is_approved
  if (typeof body.is_admin === 'boolean') {
    if (id === user!.id && body.is_admin === false) {
      return NextResponse.json({ error: 'Cannot remove your own admin status' }, { status: 400 })
    }
    updates.is_admin = body.is_admin
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields' }, { status: 400 })
  }

  const service = createServiceClient()
  const { error } = await service.from('users').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
