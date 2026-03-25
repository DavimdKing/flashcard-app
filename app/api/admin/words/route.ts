import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { synthesizeSpeech } from '@/lib/tts'
import { NextResponse } from 'next/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: appUser } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
  if (!appUser?.is_admin) return null
  return user
}

export async function POST(request: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  const { id, english_word, thai_translation, image_url } = body

  if (!id || !english_word || !thai_translation || !image_url) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const service = createServiceClient()

  let audio_url: string | null = null
  let audio_warning = false
  try {
    const audioBuffer = await synthesizeSpeech(english_word)
    const filePath = `tts/${id}.mp3`
    await service.storage.from('tts').upload(filePath, audioBuffer, { contentType: 'audio/mpeg' })
    const { data: { publicUrl } } = service.storage.from('tts').getPublicUrl(filePath)
    audio_url = publicUrl
  } catch {
    audio_warning = true
  }

  const { error } = await service.from('words').insert({ id, english_word, thai_translation, image_url, audio_url })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, audio_warning })
}
