import { NextResponse } from 'next/server'
import { requireApprovedUser, UUID_RE } from '../_auth'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ word_id: string }> }
) {
  const { user, supabase, error } = await requireApprovedUser()
  if (error) return error

  const { word_id } = await params
  if (!UUID_RE.test(word_id)) {
    return NextResponse.json({ error: 'Invalid word_id' }, { status: 400 })
  }

  const { error: deleteError } = await supabase
    .from('mistake_words')
    .delete()
    .eq('user_id', user!.id)
    .eq('word_id', word_id)
  if (deleteError) return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
