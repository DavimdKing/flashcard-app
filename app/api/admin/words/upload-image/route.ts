import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: appUser } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
  if (!appUser?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const formData = await request.formData()
  const file = formData.get('file') as File
  const wordId = formData.get('word_id') as string

  if (!file || !wordId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'File too large' }, { status: 400 })

  const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Only JPEG, PNG, and WebP images are allowed' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const EXT_MAP: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  }
  const ext = EXT_MAP[file.type] ?? 'jpg'
  const filePath = `images/${wordId}.${ext}`

  const service = createServiceClient()
  const { error } = await service.storage.from('images').upload(filePath, buffer, {
    contentType: file.type,
    upsert: true,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: { publicUrl } } = service.storage.from('images').getPublicUrl(filePath)
  return NextResponse.json({ image_url: publicUrl })
}
