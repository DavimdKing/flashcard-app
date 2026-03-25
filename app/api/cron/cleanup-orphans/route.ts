import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const secret = request.headers.get('authorization')?.replace('Bearer ', '')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = createServiceClient()

  const { data: words } = await service.from('words').select('id')
  const wordIds = new Set((words ?? []).map(w => w.id))

  const { data: files } = await service.storage.from('images').list('images', { limit: 1000 })
  const orphans = (files ?? []).filter(f => {
    const id = f.name.split('.')[0]
    return !wordIds.has(id)
  })

  if (orphans.length > 0) {
    await service.storage.from('images').remove(orphans.map(f => `images/${f.name}`))
  }

  return NextResponse.json({ deleted: orphans.length })
}
