import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { toBangkokDateString } from '@/lib/bangkok-date'
import { NextResponse } from 'next/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: a } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
  return a?.is_admin ? user : null
}

export async function GET() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const service = createServiceClient()
  const today = toBangkokDateString()

  const { data: settings } = await service.from('site_settings').select('random_exclusion_days').eq('id', 1).single()
  const exclusionDays = settings?.random_exclusion_days ?? 7

  const { data: set } = await service
    .from('daily_sets').select('id, published_at')
    .eq('set_date', today).single()

  let currentWords: any[] = []
  if (set) {
    const { data: sw } = await service
      .from('daily_set_words')
      .select('position, word_id, words(english_word, thai_translation, image_url)')
      .eq('set_id', set.id)
      .order('position')
    currentWords = (sw ?? [])
      .filter((w: any) => w.words != null)
      .map((w: any) => ({
        word_id: w.word_id, position: w.position,
        english_word: w.words.english_word, thai_translation: w.words.thai_translation,
      }))
  }

  const { data: allWords } = await service
    .from('words').select('id, english_word, thai_translation').eq('is_deleted', false)
  const wordCount = allWords?.length ?? 0
  const canRandom = wordCount >= 20

  return NextResponse.json({
    set_id: set?.id ?? null,
    published: set ? !!set.published_at : false,
    current_words: currentWords,
    word_count: wordCount,
    can_random: canRandom,
    exclusion_days: exclusionDays,
  })
}

export async function POST(request: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  const { word_ids, publish, confirm_overwrite } = body

  if (!Array.isArray(word_ids) || word_ids.length !== 10) {
    return NextResponse.json({ error: 'Exactly 10 words required' }, { status: 400 })
  }

  const service = createServiceClient()
  const today = toBangkokDateString()

  // Validate all word_ids are real, non-deleted words
  const { data: validWords } = await service
    .from('words')
    .select('id')
    .in('id', word_ids)
    .eq('is_deleted', false)

  const validIds = new Set((validWords ?? []).map(w => w.id))
  const invalidIds = word_ids.filter((id: string) => !validIds.has(id))
  if (invalidIds.length > 0) {
    return NextResponse.json({ error: 'Some word IDs are invalid or deleted' }, { status: 400 })
  }

  const { data: existing } = await service
    .from('daily_sets').select('id, published_at').eq('set_date', today).single()

  if (existing?.published_at && publish && !confirm_overwrite) {
    return NextResponse.json({ error: 'confirm_overwrite_required' }, { status: 409 })
  }

  let setId = existing?.id

  if (!setId) {
    const { data: newSet, error: insertError } = await service
      .from('daily_sets').insert({ set_date: today }).select('id').single()
    if (insertError || !newSet) {
      return NextResponse.json({ error: 'Failed to create set' }, { status: 500 })
    }
    setId = newSet.id
  }

  if (existing?.published_at && confirm_overwrite) {
    await service.from('user_progress').delete().eq('set_id', setId)
  }

  await service.from('daily_set_words').delete().eq('set_id', setId)
  const rows = word_ids.map((wid: string, idx: number) => ({
    set_id: setId,
    word_id: wid,
    position: idx + 1,
  }))
  await service.from('daily_set_words').insert(rows)

  if (publish) {
    await service.from('daily_sets').update({ published_at: new Date().toISOString() }).eq('id', setId)
  }

  return NextResponse.json({ ok: true })
}

export async function PUT() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const service = createServiceClient()
  const today = toBangkokDateString()

  const { data: settings } = await service.from('site_settings').select('random_exclusion_days').eq('id', 1).single()
  const N = Math.min(settings?.random_exclusion_days ?? 7, 60)

  const { formatInTimeZone } = await import('date-fns-tz')
  const { subDays } = await import('date-fns')
  const cutoff = formatInTimeZone(subDays(new Date(), N), 'Asia/Bangkok', 'yyyy-MM-dd')

  const { data: recentSets } = await service
    .from('daily_sets')
    .select('id')
    .gte('set_date', cutoff)
    .lt('set_date', today)
    .not('published_at', 'is', null)

  const recentSetIds = (recentSets ?? []).map((s: any) => s.id)
  let excludedWordIds: string[] = []

  if (recentSetIds.length > 0) {
    const { data: recentWords } = await service
      .from('daily_set_words').select('word_id').in('set_id', recentSetIds)
    excludedWordIds = (recentWords ?? []).map((w: any) => w.word_id)
  }

  const { data: allWords } = await service
    .from('words').select('id, english_word, thai_translation').eq('is_deleted', false)
  if (!allWords) return NextResponse.json({ error: 'No words' }, { status: 500 })

  const eligible = allWords.filter(w => !excludedWordIds.includes(w.id))
  const shuffled = [...eligible].sort(() => Math.random() - 0.5)
  let selected = shuffled.slice(0, 10)

  if (selected.length < 10 && recentSetIds.length > 0) {
    const { data: orderedExcluded } = await service
      .from('daily_set_words')
      .select('word_id, daily_sets(set_date)')
      .in('set_id', recentSetIds)
      .order('set_date', { foreignTable: 'daily_sets', ascending: true })

    const seenWordIds = new Set(selected.map(w => w.id))
    const backfillWordIds: string[] = []
    for (const row of (orderedExcluded ?? [])) {
      if (!seenWordIds.has(row.word_id)) {
        seenWordIds.add(row.word_id)
        backfillWordIds.push(row.word_id)
      }
    }

    const backfillWords = allWords.filter(w => backfillWordIds.includes(w.id))
      .sort((a, b) => backfillWordIds.indexOf(a.id) - backfillWordIds.indexOf(b.id))

    selected = [...selected, ...backfillWords].slice(0, 10)
  }

  const warn = eligible.length < 10
  return NextResponse.json({ words: selected, warn })
}
