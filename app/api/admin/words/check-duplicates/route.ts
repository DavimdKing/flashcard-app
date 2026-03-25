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
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null)
  if (!body || !Array.isArray(body.words)) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const words: string[] = body.words
  if (words.length === 0) return NextResponse.json({ duplicates: [] })

  const service = createServiceClient()
  const { data, error } = await service
    .from('words')
    .select('english_word')
    .eq('is_deleted', false)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const existingLower = new Set(
    (data ?? []).map((r: { english_word: string }) => r.english_word.toLowerCase())
  )
  const duplicates = words.filter(w => existingLower.has(w.toLowerCase()))

  return NextResponse.json({ duplicates })
}
