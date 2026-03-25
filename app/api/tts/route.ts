import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { synthesizeSpeech } from '@/lib/tts'
import { NextResponse } from 'next/server'

// Rate limit: 60 calls per minute per user (in-memory, resets on cold start)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(userId)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + 60_000 })
    return true
  }
  if (entry.count >= 60) return false
  entry.count++
  return true
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: appUser } = await supabase
    .from('users').select('is_admin').eq('id', user.id).single()
  if (!appUser?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!checkRateLimit(user.id)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  const { word_id, english_word } = await request.json()
  if (!word_id || !english_word) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const audioBuffer = await synthesizeSpeech(english_word)

  const service = createServiceClient()
  const filePath = `tts/${word_id}.mp3`
  const { error: uploadError } = await service.storage
    .from('tts')
    .upload(filePath, audioBuffer, { contentType: 'audio/mpeg', upsert: true })

  if (uploadError) {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }

  const { data: { publicUrl } } = service.storage.from('tts').getPublicUrl(filePath)

  await service.from('words').update({ audio_url: publicUrl }).eq('id', word_id)

  return NextResponse.json({ audio_url: publicUrl })
}
