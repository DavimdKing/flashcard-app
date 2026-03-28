import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ word_id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: appUser } = await supabase
    .from('users').select('is_approved').eq('id', user.id).single()
  if (!appUser?.is_approved) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { word_id } = await params
  if (!UUID_RE.test(word_id)) {
    return NextResponse.json({ error: 'Invalid word_id' }, { status: 400 })
  }

  await supabase
    .from('mistake_words')
    .delete()
    .eq('user_id', user.id)
    .eq('word_id', word_id)

  return NextResponse.json({ ok: true })
}
