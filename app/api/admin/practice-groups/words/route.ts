import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: appUser } = await supabase
    .from('users').select('is_admin').eq('id', user.id).single()
  if (!appUser?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const q = new URL(request.url).searchParams.get('q') ?? ''
  const service = createServiceClient()

  const { data } = await service
    .from('words')
    .select('id, english_word, thai_translation')
    .ilike('english_word', `%${q}%`)
    .eq('is_deleted', false)
    .limit(20)

  return NextResponse.json(data ?? [])
}
