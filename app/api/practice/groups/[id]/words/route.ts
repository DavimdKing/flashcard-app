import { createClient } from '@/lib/supabase/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface WordRow {
  position: number
  words: {
    id: string
    english_word: string
    part_of_speech: string | null
    thai_translation: string
    english_example: string | null
    thai_example: string | null
  } | null
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: appUser } = await supabase
    .from('users')
    .select('is_approved')
    .eq('id', user.id)
    .single()
  if (!appUser?.is_approved)
    return Response.json({ error: 'Forbidden' }, { status: 403 })

  if (!UUID_RE.test(id))
    return Response.json({ error: 'Not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('practice_group_words')
    .select(
      `position, words ( id, english_word, part_of_speech, thai_translation, english_example, thai_example )`,
    )
    .eq('group_id', id)
    .order('position')

  if (error)
    return Response.json({ error: 'Internal error' }, { status: 500 })

  const words = ((data ?? []) as unknown as WordRow[])
    .filter((r) => r.words !== null)
    .map((r) => ({
      id: r.words!.id,
      english_word: r.words!.english_word,
      part_of_speech: r.words!.part_of_speech,
      thai_translation: r.words!.thai_translation,
      english_example: r.words!.english_example,
      thai_example: r.words!.thai_example,
    }))

  return Response.json(words)
}
