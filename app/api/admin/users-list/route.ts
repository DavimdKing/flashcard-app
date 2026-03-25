import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json([], { status: 401 })
  const { data: a } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
  if (!a?.is_admin) return NextResponse.json([], { status: 403 })

  const service = createServiceClient()
  const { data } = await service.from('users').select('*').order('created_at', { ascending: false })
  return NextResponse.json(data ?? [])
}
