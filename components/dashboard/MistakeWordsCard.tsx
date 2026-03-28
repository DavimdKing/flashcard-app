import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

interface Props {
  userId: string
}

export default async function MistakeWordsCard({ userId }: Props) {
  const supabase = await createClient()
  const { count } = await supabase
    .from('mistake_words')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  const total = count ?? 0

  return (
    <Link href="/mistake-words" className="flex-1 block">
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm h-full relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-orange-400 to-red-400" />
        <p className="text-xs font-semibold text-orange-500 uppercase tracking-wide mb-1">Mistake Words</p>
        {total > 0 ? (
          <>
            <p className="text-xl font-bold text-gray-800">{total}</p>
            <p className="text-xs text-gray-400 mt-0.5">words to review →</p>
          </>
        ) : (
          <>
            <p className="text-xl font-bold text-green-600">0</p>
            <p className="text-xs text-gray-400 mt-0.5">all clear ✓</p>
          </>
        )}
      </div>
    </Link>
  )
}
