import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: a } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
  return a?.is_admin ? user : null
}

export async function PATCH(request: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const val = parseInt(body.random_exclusion_days, 10)
  if (isNaN(val) || val < 1 || val > 60) {
    return NextResponse.json({ error: 'Value must be 1–60' }, { status: 400 })
  }

  const service = createServiceClient()
  await service.from('site_settings').update({ random_exclusion_days: val }).eq('id', 1)
  return NextResponse.json({ ok: true })
}
