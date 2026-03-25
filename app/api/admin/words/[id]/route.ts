import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { synthesizeSpeech } from '@/lib/tts'
import { NextResponse } from 'next/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: appUser } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
  return appUser?.is_admin ? user : null
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id: wordId } = await params
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  const { english_word, thai_translation, image_url } = body

  const service = createServiceClient()
  const { data: existing } = await service.from('words').select('english_word, audio_url').eq('id', wordId).single()
  let audio_url = existing?.audio_url ?? null
  let audio_warning = false

  if (existing && existing.english_word !== english_word) {
    try {
      const audioBuffer = await synthesizeSpeech(english_word)
      const filePath = `tts/${wordId}.mp3`
      await service.storage.from('tts').upload(filePath, audioBuffer, { contentType: 'audio/mpeg', upsert: true })
      const { data: { publicUrl } } = service.storage.from('tts').getPublicUrl(filePath)
      audio_url = publicUrl
    } catch {
      audio_warning = true
    }
  }

  const updates: Record<string, string | null> = { english_word, thai_translation }
  if (image_url) updates.image_url = image_url
  if (audio_url) updates.audio_url = audio_url

  const { error } = await service.from('words').update(updates).eq('id', wordId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, audio_warning })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const service = createServiceClient()

  // Soft-delete the word
  const { error } = await service.from('words').update({ is_deleted: true }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Best-effort cleanup of storage files (all possible extensions)
  const imageExts = ['jpg', 'png', 'webp']
  const imagePaths = imageExts.map((ext) => `images/${id}.${ext}`)
  await service.storage.from('images').remove(imagePaths)
  await service.storage.from('tts').remove([`tts/${id}.mp3`])

  return NextResponse.json({ ok: true })
}
