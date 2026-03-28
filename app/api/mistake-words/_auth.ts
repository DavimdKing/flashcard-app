import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function requireApprovedUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, supabase, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: appUser } = await supabase.from('users').select('is_approved').eq('id', user.id).single()
  if (!appUser?.is_approved) return { user: null, supabase, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { user, supabase, error: null }
}
